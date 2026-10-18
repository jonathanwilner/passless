//! Desktop notification handling for user presence and verification
//!
//! This module provides desktop notification support with compatibility for
//! different notification servers (notify-osd, mako, Dunst, etc.).

use std::time::{Duration, Instant};

use futures_lite::{StreamExt, future};

use log::{debug, info, warn};
use notify_rust::{Notification, Timeout, Urgency};

const INTERACTION_MODE_ENV: &str = "PASSLESS_INTERACTION_MODE";

/// Result of user interaction via notification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationResult {
    /// User approved the operation
    Accepted,
    /// User denied the operation
    Denied,
}

/// Result of a yes/no question via notification
pub type YesNoResult = NotificationResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PromptKind {
    UserPresence,
    UserVerification,
    YesNo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InteractionMode {
    Desktop,
    Automatic,
}

fn interaction_mode_from_value(value: Option<&str>) -> Result<InteractionMode, String> {
    let Some(value) = value else {
        return Ok(InteractionMode::Desktop);
    };

    match value.trim().to_ascii_lowercase().as_str() {
        "desktop" => Ok(InteractionMode::Desktop),
        "automatic" => Ok(InteractionMode::Automatic),
        other => Err(format!(
            "invalid {} value '{}'; expected 'desktop' or 'automatic'",
            INTERACTION_MODE_ENV, other
        )),
    }
}

fn configured_interaction_mode() -> Result<InteractionMode, String> {
    match std::env::var(INTERACTION_MODE_ENV) {
        Ok(value) => interaction_mode_from_value(Some(&value)),
        Err(std::env::VarError::NotPresent) => interaction_mode_from_value(None),
        Err(std::env::VarError::NotUnicode(_)) => {
            Err(format!("{} must contain valid UTF-8", INTERACTION_MODE_ENV))
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NotificationActionMode {
    Explicit,
    Default,
    DunstDefault,
}

impl NotificationActionMode {
    fn uses_default_action(self) -> bool {
        matches!(self, Self::Default | Self::DunstDefault)
    }
}

/// Determine how actions should be exposed for a notification server.
///
/// Legacy compatibility servers use a default action for all prompt types.
/// Dunst gets that behavior only for CTAP user presence: its actions are
/// supported but normally invoked through Dunst's interaction model instead
/// of visible buttons. User verification deliberately keeps explicit actions
/// so the UP compatibility path cannot silently weaken UV semantics.
fn action_mode_for_server(
    server_name: &str,
    server_version: &str,
    prompt_kind: PromptKind,
) -> NotificationActionMode {
    let server_name = server_name.to_lowercase();

    match (server_name.as_str(), server_version) {
        ("notify-osd", "1.0") | ("mako", "0.0.0") => NotificationActionMode::Default,
        ("dunst", _) if prompt_kind == PromptKind::UserPresence => {
            NotificationActionMode::DunstDefault
        }
        _ => NotificationActionMode::Explicit,
    }
}

fn notification_action_mode(prompt_kind: PromptKind) -> NotificationActionMode {
    // Discovery must also terminate if the notification server is unresponsive.
    let server: Result<(String, String, String, String), String> = future::block_on(future::race(
        async {
            let connection = zbus::Connection::session()
                .await
                .map_err(|e| e.to_string())?;
            let proxy = zbus::Proxy::new(
                &connection,
                "org.freedesktop.Notifications",
                "/org/freedesktop/Notifications",
                "org.freedesktop.Notifications",
            )
            .await
            .map_err(|e| e.to_string())?;
            proxy
                .call("GetServerInformation", &())
                .await
                .map_err(|e| e.to_string())
        },
        async {
            async_io::Timer::after(Duration::from_secs(2)).await;
            Err("notification server discovery timed out".to_string())
        },
    ));
    server
        .map(|(name, _vendor, version, _spec)| {
            let mode = action_mode_for_server(&name, &version, prompt_kind);
            debug!("Notification server: {} (version: {})", name, version);

            match mode {
                NotificationActionMode::Default => {
                    info!("Detected {} - using default action mode", name);
                }
                NotificationActionMode::DunstDefault => {
                    info!("Detected Dunst - using UP-specific default action mode");
                }
                NotificationActionMode::Explicit => {}
            }

            mode
        })
        .unwrap_or_else(|e| {
            warn!("Failed to get notification server info: {}", e);
            NotificationActionMode::Explicit
        })
}

fn action_is_accepted(
    action: &str,
    affirmative_action: &str,
    action_mode: NotificationActionMode,
) -> bool {
    if action == affirmative_action {
        return true;
    }

    action == "default" && action_mode.uses_default_action()
}

/// Own the subscription and cancel it at a local monotonic deadline. Desktop
/// servers may ignore expire_timeout for critical notifications. No detached
/// waiter survives expiry, and a late queued click cannot authorize a request.
fn wait_for_notification(notification: &Notification, timeout: Duration) -> Result<String, String> {
    future::block_on(async {
        let deadline = Instant::now() + timeout.min(Duration::from_secs(300));
        let mut handle = None;
        let result = future::race(
            async {
                let connection = zbus::Connection::session()
                    .await
                    .map_err(|e| e.to_string())?;
                let proxy = zbus::Proxy::new(
                    &connection,
                    "org.freedesktop.Notifications",
                    "/org/freedesktop/Notifications",
                    "org.freedesktop.Notifications",
                )
                .await
                .map_err(|e| e.to_string())?;
                // Subscribe before Notify so even an immediate response is queued.
                // Proxy signals are filtered to this service owner and object path.
                let mut signals = proxy
                    .receive_all_signals()
                    .await
                    .map_err(|e| e.to_string())?;
                handle = Some(notification.show_async().await.map_err(|e| e.to_string())?);
                let id = handle.as_ref().unwrap().id();
                while let Some(message) = signals.next().await {
                    if Instant::now() >= deadline {
                        break;
                    }
                    match message.header().member().map(|name| name.as_str()) {
                        Some("ActionInvoked") => {
                            if let Ok((nid, action)) = message.body().deserialize::<(u32, String)>()
                            {
                                if nid == id && Instant::now() < deadline {
                                    return Ok(action);
                                }
                            }
                        }
                        Some("NotificationClosed") => {
                            if let Ok((nid, _)) = message.body().deserialize::<(u32, u32)>() {
                                if nid == id {
                                    break;
                                }
                            }
                        }
                        _ => {}
                    }
                }
                Ok("__closed".to_string())
            },
            async {
                async_io::Timer::at(deadline).await;
                Ok("__closed".to_string())
            },
        )
        .await;
        // Closing is best effort and bounded too: some broken servers never
        // reply or emit NotificationClosed. Dropping the wait removed its stream.
        if let Some(handle) = handle {
            future::race(handle.close_async(), async {
                async_io::Timer::after(Duration::from_millis(200)).await;
            })
            .await;
        }
        result
    })
}

fn show_confirmation_notification(
    operation: &str,
    relying_party: Option<&str>,
    user: Option<&str>,
    timeout_seconds: u32,
    prompt_kind: PromptKind,
) -> Result<NotificationResult, String> {
    debug_assert!(prompt_kind != PromptKind::YesNo);

    if configured_interaction_mode()? == InteractionMode::Automatic {
        warn!(
            "{}=automatic: auto-approving {:?} without user interaction (rp={})",
            INTERACTION_MODE_ENV,
            prompt_kind,
            relying_party.unwrap_or("<unknown>")
        );
        return Ok(NotificationResult::Accepted);
    }

    if timeout_seconds == 0 {
        return Ok(NotificationResult::Denied);
    }

    let action_mode = notification_action_mode(prompt_kind);

    let mut message = format!("Operation: {}", operation);
    if let Some(rp) = relying_party {
        message.push_str(&format!("\nRelying Party: {}", rp));
    }
    if let Some(user) = user {
        message.push_str(&format!("\nUser: {}", user));
    }

    if action_mode == NotificationActionMode::DunstDefault {
        message.push_str(
            "\n\nDunst: confirm by invoking this notification's action \
             (middle-click by default). Closing the notification denies the request.",
        );
    }

    let summary = match prompt_kind {
        PromptKind::UserPresence => "👆 User Presence Required",
        PromptKind::UserVerification => "🔒 User Verification Required",
        PromptKind::YesNo => unreachable!("yes/no prompts use show_yes_no_notification"),
    };

    info!("Showing {} notification", summary);

    let mut notification = Notification::new();
    notification
        .summary(summary)
        .body(&message)
        .icon("security-high")
        .timeout(Timeout::Milliseconds(
            timeout_seconds.saturating_mul(1000).min(i32::MAX as u32),
        ))
        .urgency(Urgency::Critical);

    if action_mode.uses_default_action() {
        notification.action("default", "");
    } else {
        notification.action("approve", "Accept");
        notification.action("deny", "Deny");
    }

    let action = wait_for_notification(
        &notification,
        Duration::from_secs(u64::from(timeout_seconds)),
    )?;

    if action_is_accepted(&action, "approve", action_mode) {
        info!("Notification accepted");
        Ok(NotificationResult::Accepted)
    } else {
        if action != "deny" && action != "__closed" {
            debug!("Unknown action '{}' - treating as denied", action);
        }
        info!("Notification denied or closed");
        Ok(NotificationResult::Denied)
    }
}

/// Show a CTAP user-presence notification and wait for response.
///
/// User presence is a consent gesture (for example, touching a hardware key),
/// so notification activation may be used as the explicit gesture on daemons
/// such as Dunst that do not expose action buttons directly.
pub fn show_user_presence_notification(
    operation: &str,
    relying_party: Option<&str>,
    user: Option<&str>,
    timeout_seconds: u32,
) -> Result<NotificationResult, String> {
    show_confirmation_notification(
        operation,
        relying_party,
        user,
        timeout_seconds,
        PromptKind::UserPresence,
    )
}

/// Show a user-verification notification and wait for response.
///
/// Unlike user presence, Dunst activation is not treated as verification: the
/// user must invoke the explicit Accept action through Dunst's action UI.
pub fn show_verification_notification(
    operation: &str,
    relying_party: Option<&str>,
    user: Option<&str>,
    timeout_seconds: u32,
) -> Result<NotificationResult, String> {
    show_confirmation_notification(
        operation,
        relying_party,
        user,
        timeout_seconds,
        PromptKind::UserVerification,
    )
}

/// Show a yes/no question notification and wait for response
///
/// # Arguments
///
/// * `title` - Title of the notification
/// * `question` - The question to ask
///
/// # Returns
///
/// Result indicating whether the user answered yes (Accepted) or no (Denied)
pub fn show_yes_no_notification(title: &str, question: &str) -> Result<YesNoResult, String> {
    info!("Showing yes/no notification: {}", title);

    let action_mode = notification_action_mode(PromptKind::YesNo);

    let mut notification = Notification::new();
    notification
        .summary(title)
        .body(question)
        .icon("dialog-question")
        .timeout(Timeout::Milliseconds(60_000))
        .urgency(Urgency::Critical);

    if action_mode.uses_default_action() {
        notification.action("default", "");
    } else {
        notification.action("yes", "Yes");
        notification.action("no", "No");
    }

    let action = wait_for_notification(&notification, Duration::from_secs(60))?;

    if action_is_accepted(&action, "yes", action_mode) {
        info!("User answered yes");
        Ok(YesNoResult::Accepted)
    } else {
        if action != "no" && action != "__closed" {
            debug!("Unknown action '{}' - treating as no", action);
        }
        info!("User answered no or closed notification");
        Ok(YesNoResult::Denied)
    }
}

/// Show an informational notification (no user response needed)
///
/// # Arguments
///
/// * `title` - Title of the notification
/// * `message` - The message to display
///
/// # Returns
///
/// Ok if notification was shown successfully
pub fn show_info_notification(title: &str, message: &str) -> Result<(), String> {
    info!("Showing info notification: {}", title);

    Notification::new()
        .summary(title)
        .body(message)
        .icon("dialog-information")
        .timeout(Timeout::Milliseconds(5000))
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;

    Ok(())
}

/// Show an error notification
///
/// # Arguments
///
/// * `title` - Title of the notification
/// * `error_message` - The error message to display
///
/// # Returns
///
/// Ok if notification was shown successfully
pub fn show_error_notification(title: &str, error_message: &str) -> Result<(), String> {
    warn!("Showing error notification: {}", title);

    Notification::new()
        .summary(title)
        .body(error_message)
        .icon("dialog-error")
        .timeout(Timeout::Milliseconds(8000))
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_result_equality() {
        assert_eq!(NotificationResult::Accepted, NotificationResult::Accepted);
        assert_eq!(NotificationResult::Denied, NotificationResult::Denied);
        assert_ne!(NotificationResult::Accepted, NotificationResult::Denied);
    }

    #[test]
    fn test_interaction_mode_defaults_to_desktop() {
        assert_eq!(
            interaction_mode_from_value(None).unwrap(),
            InteractionMode::Desktop
        );
        assert_eq!(
            interaction_mode_from_value(Some("desktop")).unwrap(),
            InteractionMode::Desktop
        );
    }

    #[test]
    fn test_interaction_mode_supports_explicit_automatic_mode() {
        assert_eq!(
            interaction_mode_from_value(Some("automatic")).unwrap(),
            InteractionMode::Automatic
        );
        assert_eq!(
            interaction_mode_from_value(Some(" Automatic ")).unwrap(),
            InteractionMode::Automatic
        );
    }

    #[test]
    fn test_interaction_mode_rejects_unknown_values() {
        let error = interaction_mode_from_value(Some("headless")).unwrap_err();
        assert!(error.contains(INTERACTION_MODE_ENV));
        assert!(error.contains("desktop"));
        assert!(error.contains("automatic"));
    }

    #[test]
    fn test_dunst_default_action_is_up_only() {
        assert_eq!(
            action_mode_for_server("dunst", "1.13.0", PromptKind::UserPresence),
            NotificationActionMode::DunstDefault
        );
        assert_eq!(
            action_mode_for_server("Dunst", "1.13.0", PromptKind::UserPresence),
            NotificationActionMode::DunstDefault
        );
        assert_eq!(
            action_mode_for_server("dunst", "1.13.0", PromptKind::UserVerification),
            NotificationActionMode::Explicit
        );
        assert_eq!(
            action_mode_for_server("dunst", "1.13.0", PromptKind::YesNo),
            NotificationActionMode::Explicit
        );
    }

    #[test]
    fn test_legacy_default_action_servers_are_preserved() {
        for (name, version) in [("notify-osd", "1.0"), ("mako", "0.0.0")] {
            for prompt_kind in [
                PromptKind::UserPresence,
                PromptKind::UserVerification,
                PromptKind::YesNo,
            ] {
                assert_eq!(
                    action_mode_for_server(name, version, prompt_kind),
                    NotificationActionMode::Default
                );
            }
        }
    }

    #[test]
    fn test_quickshell_requires_explicit_actions() {
        for kind in [
            PromptKind::UserPresence,
            PromptKind::UserVerification,
            PromptKind::YesNo,
        ] {
            for version in ["", "0.2.1"] {
                assert_eq!(
                    action_mode_for_server("quickshell", version, kind),
                    NotificationActionMode::Explicit
                );
            }
        }
    }

    #[test]
    fn test_unknown_servers_use_explicit_actions() {
        assert_eq!(
            action_mode_for_server("gnome-shell", "47", PromptKind::UserPresence),
            NotificationActionMode::Explicit
        );
    }

    #[test]
    fn test_default_action_acceptance_is_mode_specific() {
        assert!(action_is_accepted(
            "default",
            "approve",
            NotificationActionMode::DunstDefault
        ));
        assert!(action_is_accepted(
            "default",
            "approve",
            NotificationActionMode::Default
        ));
        assert!(!action_is_accepted(
            "default",
            "approve",
            NotificationActionMode::Explicit
        ));
        assert!(action_is_accepted(
            "approve",
            "approve",
            NotificationActionMode::Explicit
        ));
        assert!(!action_is_accepted(
            "deny",
            "approve",
            NotificationActionMode::DunstDefault
        ));
        assert!(!action_is_accepted(
            "__closed",
            "approve",
            NotificationActionMode::DunstDefault
        ));
    }

    #[test]
    fn test_notification_action_mode_doesnt_panic() {
        let _ = notification_action_mode(PromptKind::UserPresence);
    }
}

#[cfg(test)]
mod deadline_tests {
    use super::*;
    use std::sync::{
        Arc, Mutex,
        atomic::{AtomicU32, Ordering},
    };

    struct FakeNotifications {
        action: Arc<Mutex<Option<String>>>,
        next_id: AtomicU32,
    }

    #[zbus::interface(name = "org.freedesktop.Notifications")]
    impl FakeNotifications {
        #[allow(clippy::too_many_arguments)]
        async fn notify(
            &self,
            _app: &str,
            _replaces: u32,
            _icon: &str,
            _summary: &str,
            _body: &str,
            _actions: Vec<String>,
            _hints: std::collections::HashMap<String, zbus::zvariant::OwnedValue>,
            _expire_timeout: i32,
            #[zbus(signal_emitter)] emitter: zbus::object_server::SignalEmitter<'_>,
        ) -> u32 {
            let id = self.next_id.fetch_add(1, Ordering::Relaxed);
            let action = self.action.lock().unwrap().clone();
            if let Some(action) = action {
                if action == "stale" {
                    Self::action_invoked(&emitter, id - 1, "approve")
                        .await
                        .unwrap();
                } else {
                    Self::action_invoked(&emitter, id, &action).await.unwrap();
                }
            }
            id
        }

        // Intentionally ignore both expiry and CloseNotification: no close signal.
        fn close_notification(&self, _id: u32) {}

        #[zbus(signal)]
        async fn action_invoked(
            emitter: &zbus::object_server::SignalEmitter<'_>,
            id: u32,
            action: &str,
        ) -> zbus::Result<()>;
    }

    /// Run under dbus-run-session: no production notifications or credentials.
    #[test]
    #[ignore = "requires a private bus: dbus-run-session -- notification-tests --include-ignored"]
    fn silent_server_deadline_and_explicit_actions() {
        let action = Arc::new(Mutex::new(None));
        let _server = future::block_on(async {
            zbus::connection::Builder::session()
                .unwrap()
                .name("org.freedesktop.Notifications")
                .unwrap()
                .serve_at(
                    "/org/freedesktop/Notifications",
                    FakeNotifications {
                        action: action.clone(),
                        next_id: AtomicU32::new(1),
                    },
                )
                .unwrap()
                .build()
                .await
                .unwrap()
        });
        let notification = Notification::new()
            .summary("Synthetic consent regression")
            .action("approve", "Accept")
            .action("deny", "Deny")
            .timeout(Timeout::Never)
            .finalize();
        let start = Instant::now();
        assert_eq!(
            wait_for_notification(&notification, Duration::from_millis(100)).unwrap(),
            "__closed"
        );
        assert!(start.elapsed() < Duration::from_secs(2));
        // Emit the expired request's approval while the next request is
        // subscribed. Its different ID must be ignored until local expiry.
        *action.lock().unwrap() = Some("stale".to_string());
        assert_eq!(
            wait_for_notification(&notification, Duration::from_millis(100)).unwrap(),
            "__closed"
        );
        for value in ["deny", "approve", "yes", "no"] {
            *action.lock().unwrap() = Some(value.to_string());
            assert_eq!(
                wait_for_notification(&notification, Duration::from_secs(2)).unwrap(),
                value
            );
        }
        assert_eq!(
            wait_for_notification(&notification, Duration::ZERO).unwrap(),
            "__closed"
        );
    }
}
