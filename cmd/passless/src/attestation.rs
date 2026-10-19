//! Packed attestation for the YubiKey emulation profile.
//!
//! The default Passless profile returns `fmt: none`. Relying parties that
//! classify hardware keys from the attestation statement need a packed
//! statement instead. This module signs `authData || clientDataHash` with a
//! synthetic P-256 key and returns a self-signed certificate whose AAGUID
//! extension matches the selected profile.
//!
//! The certificate is not issued by Yubico. It is an emulation asset with no
//! relationship to a physical YubiKey or to Yubico's attestation CA.

use crate::fido_profile::{self, FidoProfile};

use ciborium::Value;

use p256::ecdsa::Signature;
use p256::ecdsa::SigningKey;
use p256::ecdsa::signature::hazmat::PrehashSigner;
use p256::pkcs8::DecodePrivateKey;

use sha2::Digest;
use sha2::Sha256;

const YUBIKEY_5_NFC_CERT: &[u8] =
    include_bytes!("../assets/attestation/yubikey-5-nfc-cert.der");
const YUBIKEY_5_NFC_KEY: &[u8] = include_bytes!("../assets/attestation/yubikey-5-nfc-key.der");

const CMD_MAKE_CREDENTIAL: u8 = 0x01;
const KEY_CLIENT_DATA_HASH: i128 = 0x01;
const KEY_FMT: i128 = 0x01;
const KEY_AUTH_DATA: i128 = 0x02;
const KEY_ATT_STMT: i128 = 0x03;

fn find<'a>(entries: &'a [(Value, Value)], key: i128) -> Option<&'a Value> {
    entries.iter().find_map(|(candidate, value)| {
        matches!(candidate, Value::Integer(integer) if integer128(integer) == key).then_some(value)
    })
}

fn integer128(value: &ciborium::value::Integer) -> i128 {
    i128::from(*value)
}

fn parse_map(bytes: &[u8]) -> Option<Vec<(Value, Value)>> {
    match ciborium::from_reader::<Value, _>(bytes).ok()? {
        Value::Map(entries) => Some(entries),
        _ => None,
    }
}

fn packed_att_statement(auth_data: &[u8], client_data_hash: &[u8]) -> Option<Value> {
    let key = SigningKey::from_pkcs8_der(YUBIKEY_5_NFC_KEY).ok()?;
    let mut signed = Vec::with_capacity(auth_data.len() + client_data_hash.len());
    signed.extend_from_slice(auth_data);
    signed.extend_from_slice(client_data_hash);
    let digest = Sha256::digest(&signed);
    let signature: Signature = key.sign_prehash(&digest).ok()?;
    let der = signature.to_der();

    Some(Value::Map(vec![
        (
            Value::Text("alg".into()),
            Value::Integer((-7i128).try_into().ok()?),
        ),
        (
            Value::Text("sig".into()),
            Value::Bytes(der.as_bytes().to_vec()),
        ),
        (
            Value::Text("x5c".into()),
            Value::Array(vec![Value::Bytes(YUBIKEY_5_NFC_CERT.to_vec())]),
        ),
    ]))
}

/// Replace the default `none` statement with a packed statement for
/// MakeCredential responses. Any parse or signing failure leaves the original
/// response untouched so an attestation problem cannot break enrollment.
pub(crate) fn rewrite_make_credential(request: &[u8], response: &mut Vec<u8>) {
    if fido_profile::current() != FidoProfile::YubiKey5Nfc
        || request.first() != Some(&CMD_MAKE_CREDENTIAL)
        || response.first() != Some(&0x00)
    {
        return;
    }

    let request_entries = match parse_map(&request[1..]) {
        Some(entries) => entries,
        None => return,
    };
    let client_data_hash = match find(&request_entries, KEY_CLIENT_DATA_HASH) {
        Some(Value::Bytes(bytes)) => bytes,
        _ => return,
    };

    let mut response_entries = match parse_map(&response[1..]) {
        Some(entries) => entries,
        None => return,
    };
    let auth_data = match find(&response_entries, KEY_AUTH_DATA) {
        Some(Value::Bytes(bytes)) => bytes.clone(),
        _ => return,
    };
    let Some(att_statement) = packed_att_statement(&auth_data, client_data_hash) else {
        return;
    };

    for (key, value) in response_entries.iter_mut() {
        if let Value::Integer(integer) = key {
            match integer128(integer) {
                KEY_FMT => *value = Value::Text("packed".into()),
                KEY_ATT_STMT => *value = att_statement.clone(),
                _ => {}
            }
        }
    }

    let mut encoded = Vec::new();
    if ciborium::into_writer(&Value::Map(response_entries), &mut encoded).is_ok() {
        response.clear();
        response.push(0x00);
        response.extend_from_slice(&encoded);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request_with_hash(hash: &[u8]) -> Vec<u8> {
        let body = Value::Map(vec![(
            Value::Integer(1i128.try_into().unwrap()),
            Value::Bytes(hash.to_vec()),
        )]);
        let mut out = vec![CMD_MAKE_CREDENTIAL];
        ciborium::into_writer(&body, &mut out).unwrap();
        out
    }

    fn response_with_auth_data(auth_data: &[u8]) -> Vec<u8> {
        let body = Value::Map(vec![
            (
                Value::Integer(1i128.try_into().unwrap()),
                Value::Text("none".into()),
            ),
            (
                Value::Integer(2i128.try_into().unwrap()),
                Value::Bytes(auth_data.to_vec()),
            ),
            (
                Value::Integer(3i128.try_into().unwrap()),
                Value::Map(vec![]),
            ),
        ]);
        let mut out = vec![0x00];
        ciborium::into_writer(&body, &mut out).unwrap();
        out
    }

    #[test]
    fn certificate_contains_the_profile_aaguid() {
        assert!(YUBIKEY_5_NFC_CERT
            .windows(16)
            .any(|window| window == fido_profile::YUBIKEY_5_NFC_AAGUID));
    }

    #[test]
    fn packed_statement_has_algorithm_signature_and_certificate() {
        let att_stmt = packed_att_statement(b"auth-data", b"client-data-hash").unwrap();
        let Value::Map(entries) = att_stmt else {
            panic!("packed statement must be a map");
        };
        let alg = entries.iter().find(|(key, _)| {
            matches!(key, Value::Text(text) if text == "alg")
        });
        assert!(matches!(alg, Some((_, Value::Integer(value))) if integer128(value) == -7));
        let sig = entries.iter().find(|(key, _)| {
            matches!(key, Value::Text(text) if text == "sig")
        });
        assert!(matches!(sig, Some((_, Value::Bytes(bytes))) if !bytes.is_empty()));
        let x5c = entries.iter().find(|(key, _)| {
            matches!(key, Value::Text(text) if text == "x5c")
        });
        assert!(matches!(x5c, Some((_, Value::Array(certs))) if certs.len() == 1));
    }

    #[test]
    fn rewrite_skips_non_make_credential_requests() {
        let mut response = response_with_auth_data(b"auth-data");
        let original = response.clone();
        rewrite_make_credential(&[0x02, 0xa0], &mut response);
        assert_eq!(response, original);
    }

    #[test]
    fn rewrite_leaves_error_responses_unchanged() {
        let mut response = vec![0x01, 0xa0];
        let original = response.clone();
        rewrite_make_credential(&request_with_hash(b"hash"), &mut response);
        assert_eq!(response, original);
    }

    #[test]
    fn rewrite_replaces_none_with_packed() {
        // The profile is read from the environment once per process. This test
        // is meaningful in a process that selected the YubiKey profile; the
        // helper is exercised directly above for the default profile.
        if FidoProfile::current() != FidoProfile::YubiKey5Nfc {
            return;
        }
        let mut response = response_with_auth_data(b"auth-data");
        rewrite_make_credential(&request_with_hash(b"client-data-hash"), &mut response);
        let entries = parse_map(&response[1..]).unwrap();
        assert_eq!(
            find(&entries, KEY_FMT),
            Some(&Value::Text("packed".into()))
        );
    }
}
