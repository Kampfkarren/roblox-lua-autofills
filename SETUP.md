# Setup
While you can always download the extension straight from [the VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=Kampfkarren.roblox-lua-autofills), you can also optionally install it manually from the source code.

roblox-lua-autofills is built like any other VS Code extension. You can learn how to debug VS Code extensions with the [official guide by Microsoft](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension).

roblox-lua-autofills is slightly different from other extensions in that it has a "companion". The companion handles functions that are too tough to do with just plain TypeScript, and thus are written in Rust. You can either uncomment out the stub code in `companion.ts` or you can build the companion.

To build the companion, we use [wasm-pack](https://rustwasm.github.io/docs/wasm-pack/) to build a WASM file to use. Install `wasm-pack`, then run `wasm-pack build --target nodejs` inside the `companion` directory. This should create a `pkg` folder. If you see this, you should be able to compile the extension in full.

If you have any problems contributing, feel free to join the [Roblox Open Source Discord](https://discord.gg/mhtGUS8) and ping me (boyned), I check it regularly.
