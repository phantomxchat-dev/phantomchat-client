# Phantom Chat Architecture & Threat Model

Phantom Chat (`phantomchat.space`) is an identity-less, ephemeral messaging terminal designed for zero-trace session communication.

## 1. Zero-Knowledge Principles
* **No Authentication / PII:** The system does not request, store, or process emails, phone numbers, IP logs, or persistent user IDs.
* **In-Memory Volatility:** All incoming socket frames are handled entirely in volatile memory (RAM) and are never written to disk.
* **Client-Side Key Generation:** Session keys are derived locally in the user's browser using the native Web Crypto API (`window.crypto.subtle`).

## 2. Session Lifecycle
1. **Pairing:** Participants connect via an ephemeral 6-digit sync code.
2. **Transit:** Packets are transmitted across volatile WebSockets.
3. **Purge:** Upon timer expiry or manual session termination, client-side encryption keys are zeroized in memory, and server relays purge active room state.

## 3. Scope of Open Source Code
This repository contains 100% of the client-side application running inside the user's browser. Users and security researchers can verify that no tracking scripts, keyloggers, or fingerprinting telemetry exist in the browser bundle.

*The backend edge-relay network remains closed-source to protect deployment infrastructure and operational security.*
