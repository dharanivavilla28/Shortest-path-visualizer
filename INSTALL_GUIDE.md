# 🏗 Installation & Deployment Guide

This guide describes how to run the project locally and how to deploy it to a public URL.

## 💻 Local Setup

1.  **Clone / Download** this project to your machine.
2.  **Install Node.js** (if not already installed).
3.  **Open terminal** in the project directory.
4.  Run `npm install` to install dependencies.
5.  Run `npm run dev` to start the local development server.
6.  Open `http://localhost:5173/` in your browser.

## 🚀 Easy Deployment (To Public URL)

To share this tool with others, you can deploy it for free using **Vercel** or **Surge**.

### Option A: Vercel (Recommended)
1.  Run `npx vercel` in the project root.
2.  Log in and follow the prompts.
3.  Vercel will give you a public URL (e.g., `shortest-path-visualizer.vercel.app`).

### Option B: Surge (Quickest)
1.  Run `npm run build` to create a production bundle.
2.  Run `npx surge dist`
3.  Type a unique domain name if prompted, and you're live!

---

## 📂 Project Structure

- `index.html`: Main UI structure and layout.
- `src/main.js`: Main application logic and vis-network integration.
- `src/algorithm.js`: Dijkstra's algorithm and Min-Heap.
- `src/style.css`: All premium design and responsive styles.
