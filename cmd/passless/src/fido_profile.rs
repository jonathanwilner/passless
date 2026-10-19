//! Host-visible FIDO identity profiles.
//!
//! The default profile keeps Passless's own AAGUID and firmware identity. The
//! YubiKey profiles present a documented YubiKey AAGUID, firmware version and
//! USB identity so relying parties that classify authenticators from FIDO
//! metadata recognise the emulator as a hardware security key.
//!
//! This is an emulation profile. It does not prove possession of Yubico
//! hardware, and it does not create a Yubico attestation signature.

use soft_fido2::CredentialBackupState;

use std::sync::LazyLock;

/// Passless's own AAGUID: the ASCII text "fido.passless.rs".
pub(crate) const PASSLESS_AAGUID: [u8; 16] = *b"fido.passless.rs";

/// YubiKey 5 Series with NFC, firmware 5.8.x.
///
/// Published by Yubico at
/// <https://support.yubico.com/s/article/YubiKey-hardware-FIDO2-AAGUIDs>.
/// This is the FIDO Certified Level 2 AAGUID shared by the YubiKey 5 NFC and
/// YubiKey 5C NFC models that OpenAI ships in its bundle.
pub(crate) const YUBIKEY_5_NFC_AAGUID: [u8; 16] = [
    0xf4, 0xce, 0x5f, 0xc0, 0x57, 0xd3, 0x46, 0xf5, 0xa7, 0x36, 0xef, 0xb7, 0xd5, 0xbc, 0x63, 0xb5,
];

/// YubiKey 5.8.0 firmware version, as reported by authenticatorGetInfo.
pub(crate) const YUBIKEY_5_NFC_FIRMWARE: u32 = 0x0508_00;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FidoProfile {
    Passless,
    YubiKey5Nfc,
}

impl FidoProfile {
    pub(crate) fn from_name(name: &str) -> Result<Self, String> {
        match name {
            "passless" => Ok(Self::Passless),
            "yubikey-5-nfc" | "yubikey" => Ok(Self::YubiKey5Nfc),
            _ => Err(format!(
                "invalid PASSLESS_FIDO_PROFILE {name:?}; expected passless or yubikey-5-nfc"
            )),
        }
    }

    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Passless => "passless",
            Self::YubiKey5Nfc => "yubikey-5-nfc",
        }
    }

    pub(crate) fn aaguid(self) -> [u8; 16] {
        match self {
            Self::Passless => PASSLESS_AAGUID,
            Self::YubiKey5Nfc => YUBIKEY_5_NFC_AAGUID,
        }
    }

    /// Firmware version reported by authenticatorGetInfo.
    pub(crate) fn firmware_version(self) -> u32 {
        match self {
            Self::Passless => *crate::authenticator::VERSION,
            Self::YubiKey5Nfc => YUBIKEY_5_NFC_FIRMWARE,
        }
    }

    /// Default USB identity for this FIDO profile.
    pub(crate) fn default_usb_identity(self) -> &'static str {
        match self {
            Self::Passless => "passless",
            Self::YubiKey5Nfc => "yubikey-fido",
        }
    }
}

pub(crate) fn from_environment() -> Result<FidoProfile, String> {
    match std::env::var("PASSLESS_FIDO_PROFILE") {
        Ok(value) => FidoProfile::from_name(&value),
        Err(std::env::VarError::NotPresent) => Ok(FidoProfile::Passless),
        Err(error) => Err(format!("invalid PASSLESS_FIDO_PROFILE: {error}")),
    }
}

static PROFILE: LazyLock<FidoProfile> =
    LazyLock::new(|| from_environment().unwrap_or(FidoProfile::Passless));

pub(crate) fn current() -> FidoProfile {
    *PROFILE
}

pub(crate) fn aaguid() -> [u8; 16] {
    current().aaguid()
}

pub(crate) fn firmware_version() -> u32 {
    current().firmware_version()
}

/// Credential backup eligibility reported in authenticator data.
///
/// A hardware security key is device-bound and advertises `BE=0`. Passless's
/// exportable backup store would otherwise advertise `BE=1`, which relying
/// parties correctly interpret as a synced or non-device-bound credential.
/// The YubiKey profile reports `NotEligible` even when the local backup
/// feature is enabled so the credential matches the hardware profile it
/// presents.
pub(crate) fn credential_backup_state(configured_eligible: bool) -> CredentialBackupState {
    match current() {
        FidoProfile::YubiKey5Nfc => CredentialBackupState::NotEligible,
        FidoProfile::Passless if configured_eligible => CredentialBackupState::Eligible,
        FidoProfile::Passless => CredentialBackupState::NotEligible,
    }
}


/// Advertise hmac-secret for the YubiKey profile.
///
/// soft-fido2 implements the extension for discoverable credentials but its
/// GetInfo filter currently exposes only credProtect. Relying parties such as
/// ChatGPT request WebAuthn PRF only when hmac-secret is advertised, so add it
/// to the extension list for this profile.
pub(crate) fn patch_get_info(response: &mut Vec<u8>) {
    if current() != FidoProfile::YubiKey5Nfc || response.first() != Some(&0x00) {
        return;
    }
    let Ok(ciborium::Value::Map(mut entries)) =
        ciborium::from_reader::<ciborium::Value, _>(&response[1..])
    else {
        return;
    };
    let mut extensions_found = false;
    for (key, value) in entries.iter_mut() {
        if matches!(key, ciborium::Value::Integer(integer) if i128::from(*integer) == 0x02)
            && let ciborium::Value::Array(extensions) = value
        {
            if !extensions
                .iter()
                .any(|item| matches!(item, ciborium::Value::Text(text) if text == "hmac-secret"))
            {
                extensions.push(ciborium::Value::Text("hmac-secret".into()));
            }
            extensions_found = true;
        }
    }
    if !extensions_found {
        if let Ok(key) = 0x02i128.try_into() {
            entries.push((
                ciborium::Value::Integer(key),
                ciborium::Value::Array(vec![ciborium::Value::Text("hmac-secret".into())]),
            ));
        }
    }
    let mut encoded = Vec::new();
    if ciborium::into_writer(&ciborium::Value::Map(entries), &mut encoded).is_ok() {
        response.clear();
        response.push(0x00);
        response.extend_from_slice(&encoded);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_state_is_disabled_for_the_yubikey_profile() {
        if current() == FidoProfile::YubiKey5Nfc {
            assert_eq!(
                credential_backup_state(true),
                CredentialBackupState::NotEligible
            );
        }
    }

    #[test]
    fn default_profile_keeps_the_passless_aaguid() {
        assert_eq!(FidoProfile::Passless.aaguid(), PASSLESS_AAGUID);
        assert_eq!(FidoProfile::Passless.name(), "passless");
    }

    #[test]
    fn yubikey_profile_uses_the_published_aaguid() {
        let profile = FidoProfile::from_name("yubikey-5-nfc").unwrap();
        assert_eq!(
            profile.aaguid(),
            [
                0xf4, 0xce, 0x5f, 0xc0, 0x57, 0xd3, 0x46, 0xf5, 0xa7, 0x36, 0xef, 0xb7, 0xd5, 0xbc,
                0x63, 0xb5,
            ]
        );
        assert_eq!(profile.firmware_version(), 0x0508_00);
        assert_eq!(profile.default_usb_identity(), "yubikey-fido");
    }

    #[test]
    fn yubikey_alias_is_accepted() {
        assert_eq!(
            FidoProfile::from_name("yubikey").unwrap(),
            FidoProfile::YubiKey5Nfc
        );
    }

    #[test]
    fn unknown_profiles_fail_explicitly() {
        assert!(FidoProfile::from_name("yubikey-9").is_err());
        assert!(FidoProfile::from_name("").is_err());
    }

    #[test]
    fn get_info_patch_is_a_noop_for_the_passless_profile() {
        if current() == FidoProfile::YubiKey5Nfc {
            return;
        }
        let mut response = vec![0x00, 0xa1, 0x02, 0x81, 0x6b];
        response.extend_from_slice(b"credProtect");
        let original = response.clone();
        patch_get_info(&mut response);
        assert_eq!(response, original);
    }
}
