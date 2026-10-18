# Third-party notices

`tests/fixtures/*.bin` are synthetic upstream compatibility fixtures from
Android Password Store, https://github.com/pando85/Android-Password-Store,
commit `7dc489ec57c9c19e5373fe602aba21f8069b5eff`.
Copyright 2014-2026 The Android Password Store Authors.
SPDX-License-Identifier: GPL-3.0-only.
The repository's root `LICENSE` contains GPL version 3.

The bundled crypto implementation is OpenPGP.js 6.3.1, pinned with npm integrity
hashes in `package-lock.json`. It is licensed under LGPL-3.0; the bundle retains
its legal comments and `scripts/bundle.mjs` copies its complete license beside
the generated assets. Source: https://github.com/openpgpjs/openpgpjs.
The source modules and build recipe allow replacing and rebuilding the library.

The CBOR reader is an independent implementation of the documented portable
credential schema. It does not modify or reserialize the imported credentials.
