mod module_dumps;

use jsonrpc_core::{IoHandler, Params, Value};
use jsonrpc_stdio_server::ServerBuilder;
use module_dumps::generate_module_dump;

fn main() {
    let mut io = IoHandler::default();
    io.add_method("generate_module_dump", |params: Params| {
        // println!("generate_module_dump");
        if let Some(code) = params.parse::<Vec<String>>()?.first() {
            if let Ok(Some(dump)) = generate_module_dump(&code) {
                return Ok(jsonrpc_core::types::to_value(dump).unwrap());
            }
        }

        Ok(Value::Null)
    });

    ServerBuilder::new(io).build();
}
