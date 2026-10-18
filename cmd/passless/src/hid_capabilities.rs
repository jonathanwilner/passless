//! Correct the transport's INIT capabilities for Passless's CBOR-only handler.

/// soft-fido2-transport 0.17 hardcodes CBOR without NMSG and has no capability
/// setter. A successful CTAPHID_INIT reply is exactly 17 bytes: nonce (8),
/// allocated CID (4), protocol/device version (4), capabilities (1).
/// Preserve every other byte and bit; malformed/continuation/other replies pass
/// through unchanged. Remove this adapter when upstream exposes capabilities.
pub(crate) fn advertise_no_msg(reply: &mut [u8; 64]) {
    const INIT_RESPONSE: u8 = 0x86;
    const CAPABILITY_NMSG: u8 = 0x08;
    if reply[4] == INIT_RESPONSE && reply[5..7] == [0, 17] {
        reply[23] |= CAPABILITY_NMSG;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_init_preserves_nonce_channel_and_other_capabilities() {
        let mut reply = [0x55; 64];
        reply[4..7].copy_from_slice(&[0x86, 0, 17]);
        reply[23] = 0x05;
        let original = reply;
        advertise_no_msg(&mut reply);
        assert_eq!(reply[23], 0x0d);
        reply[23] = original[23];
        assert_eq!(reply, original);
    }

    #[test]
    fn other_packets_and_malformed_lengths_are_unchanged() {
        for (cmd, len) in [(0x86, 16u16), (0x86, 18), (0x86, 273), (0x90, 17), (0xbf, 17), (0x06, 17)] {
            let mut reply = [0x55; 64];
            reply[4] = cmd;
            reply[5..7].copy_from_slice(&len.to_be_bytes());
            let original = reply;
            advertise_no_msg(&mut reply);
            assert_eq!(reply, original);
        }
    }

    #[test]
    fn repeated_application_is_idempotent() {
        let mut reply = [0; 64];
        reply[4..7].copy_from_slice(&[0x86, 0, 17]);
        reply[23] = 0x0c;
        let original = reply;
        advertise_no_msg(&mut reply);
        assert_eq!(reply, original);
    }
}
