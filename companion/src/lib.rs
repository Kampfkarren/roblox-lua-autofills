mod module_dumps;

pub use module_dumps::{generate_module_dump, MemberType};

use js_sys::Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn generate_module_dump_js(code: String) -> Option<Array> {
    let output = Array::new();

    for (name, member_type) in generate_module_dump(&code).ok()?? {
		let value = Array::new();
		value.push(&JsValue::from(name));
		value.push(&JsValue::from(member_type.to_string()));

		output.push(&value);
    }

    Some(output)
}
