<div align="center">

<img src="assets/banner.png" alt="banner" width="100%" />

# 🏆 BTCUSD Protocol

**Bitcoin-backed stablecoin with automatic yield farming — built on Starknet**

![Cairo](https://img.shields.io/badge/Cairo-FF6B35?style=flat-square) ![Starknet](https://img.shields.io/badge/Starknet-FF4B8B?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

*1st Place · Starknet Re{Solve} Hackathon*

</div>

<br/>

BTCUSD lets you deposit wBTC as collateral to mint a USD-pegged stablecoin, while your collateral automatically earns real yield in Vesu lending pools. Built with Cairo smart contracts on Starknet, featuring liquidation bots, real-time price oracles, and a React Native mobile app.

## ✨ Features

- Mint BTCUSD stablecoin against wBTC at 150% collateral ratio
- Auto yield farming — collateral earns in Vesu pools, 70% returned to users
- Real-time liquidation engine with autonomous keeper bot
- Live price feeds via Pragma Oracle
- React Native mobile app with Starknet wallet support
- Fully deployed and verified on Starknet Sepolia

## 🎥 Demo

[![Watch Demo](https://img.shields.io/badge/YouTube-Watch%20Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=5ijxs1PgWgM)

## 🛠️ Tech Stack

Cairo · Starknet · React Native · Node.js · Vesu · Pragma Oracle · TypeScript

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, Scarb, Expo CLI

```bash
# Contracts
cd contracts && scarb build && snforge test

# Mobile app
cd app && npm install && npm run ios

# Backend keepers
cd backend && npm install && npm run dev
```

## 📄 License

MIT
