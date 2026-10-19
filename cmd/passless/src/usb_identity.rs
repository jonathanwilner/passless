//! Opt-in host HID identity. This does not change CTAP identity or attestation.

#[derive(Debug, PartialEq)]
pub(crate) struct UsbIdentity {
    pub name: &'static str,
    pub vendor: u16,
    pub product: u16,
}

impl UsbIdentity {
    fn from_profile(profile: &str) -> Result<Self, String> {
        match profile {
            "passless" => Ok(Self {
                name: "Virtual FIDO2 Authenticator",
                vendor: 0x15d9,
                product: 0x0a37,
            }),
            // Yubico's published FIDO-only USB identity:
            // https://docs.yubico.com/yesdk/users-manual/yubikey-reference/transports/overview.html
            "yubikey-fido" => Ok(Self {
                name: "YubiKey FIDO",
                vendor: 0x1050,
                product: 0x0402,
            }),
            _ => Err(format!(
                "invalid PASSLESS_USB_IDENTITY {profile:?}; expected passless or yubikey-fido"
            )),
        }
    }

    pub fn from_environment() -> Result<Self, String> {
        let profile = match std::env::var("PASSLESS_USB_IDENTITY") {
            Ok(profile) => profile,
            Err(std::env::VarError::NotPresent) => {
                crate::fido_profile::current().default_usb_identity().into()
            }
            Err(e) => return Err(format!("invalid PASSLESS_USB_IDENTITY: {e}")),
        };
        let identity = Self::from_profile(&profile)?;
        #[cfg(debug_assertions)]
        let identity = identity.with_test_ids(
            std::env::var("PASSLESS_TEST_VENDOR_ID").ok().as_deref(),
            std::env::var("PASSLESS_TEST_PRODUCT_ID").ok().as_deref(),
        );
        Ok(identity)
    }

    #[cfg(debug_assertions)]
    fn with_test_ids(mut self, vendor: Option<&str>, product: Option<&str>) -> Self {
        fn parse(value: Option<&str>) -> Option<u16> {
            value.and_then(|s| u16::from_str_radix(s.strip_prefix("0x").unwrap_or(s), 16).ok())
        }
        self.vendor = parse(vendor).unwrap_or(self.vendor);
        self.product = parse(product).unwrap_or(self.product);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_identity_is_unchanged() {
        let id = UsbIdentity::from_profile("passless").unwrap();
        assert_eq!((id.vendor, id.product), (0x15d9, 0x0a37));
        assert_eq!(id.name, "Virtual FIDO2 Authenticator");
    }

    #[test]
    fn yubikey_profile_is_fido_only() {
        let id = UsbIdentity::from_profile("yubikey-fido").unwrap();
        assert_eq!((id.vendor, id.product), (0x1050, 0x0402));
        assert_eq!(id.name, "YubiKey FIDO");
    }

    #[test]
    fn invalid_profile_fails_explicitly() {
        assert!(UsbIdentity::from_profile("yubikey").is_err());
        assert!(UsbIdentity::from_profile("").is_err());
    }

    #[test]
    #[cfg(debug_assertions)]
    fn debug_test_ids_override_profile_without_env_races() {
        let id = UsbIdentity::from_profile("yubikey-fido")
            .unwrap()
            .with_test_ids(Some("0xffff"), Some("abcd"));
        assert_eq!((id.vendor, id.product), (0xffff, 0xabcd));
        let id = id.with_test_ids(Some("invalid"), None);
        assert_eq!((id.vendor, id.product), (0xffff, 0xabcd));
    }
}
