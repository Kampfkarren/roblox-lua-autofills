# Setup
While you can always download the extension straight from [the VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=Kampfkarren.roblox-lua-autofills), you can also optionally install it manually from the source code.

roblox-lua-autofills is built like any other VS Code extension. You can learn how to debug VS Code extensions with the [official guide by Microsoft](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension).

roblox-lua-autofills is slightly different from other extensions in that it has a "companion". The companion handles functions that are too tough to do with just plain TypeScript, and thus are written in Rust. While it's not necessary for a working roblox-lua-autofills, if you want a fully feature complete version, you will have to build it.

To build the companion, you'll first need to [install Rust](https://rustup.rs/). From there, go into the `companion` directory and run the command `cargo build --release`. After it is done, you should be able to open up the `target/release` directory and see a built copy. Create a folder called `bin` at the root, and insert the release into there.

If you have any problems contributing, feel free to join the [Roblox Open Source Discord](https://discord.gg/mhtGUS8) and ping me (boyned), I check it regularly.
