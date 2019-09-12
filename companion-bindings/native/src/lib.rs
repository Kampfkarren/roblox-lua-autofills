use neon::prelude::*;

// generateModuleDump(code: string): [[string, MemberType]];
fn generate_module_dump(mut cx: FunctionContext) -> JsResult<JsArray> {
    let code = cx.argument::<JsString>(0)?.value();
    let dump = companion::generate_module_dump(&code);

    if let Ok(Some(dump)) = dump {
        let js_array = JsArray::new(&mut cx, dump.len() as u32);

        for (index, (name, member_type)) in dump.into_iter().enumerate() {
            let value = JsArray::new(&mut cx, 2);

            let name = cx.string(name);
            value.set(&mut cx, 0, name)?;

            let member_type = cx.string(member_type.to_string());
            value.set(&mut cx, 1, member_type)?;

            js_array.set(&mut cx, index as u32, value)?;
        }

        Ok(js_array)
    } else {
        Ok(JsArray::new(&mut cx, 0))
    }
}

neon::register_module!(mut cx, {
    cx.export_function("generateModuleDump", generate_module_dump)
});
