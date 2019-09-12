use pretty_assertions::assert_eq;
use std::collections::BTreeMap;
use std::fs;

macro_rules! run_tests {
	{
		$(
			$module_name: ident,
		)+
	} => {
		$(
			#[test]
			fn $module_name() {
				let source = fs::read_to_string(
						format!("./tests/module_dumps/{}.lua", stringify!($module_name))
					).expect("can't read test file");

				let module_dump = companion::generate_module_dump(&source)
					.expect("can't generate module dump");

				let output_file = format!("./tests/module_dumps/{}.json", stringify!($module_name));

				if let Ok(expected) = fs::read_to_string(&output_file) {
					let expected: Option<BTreeMap<String, companion::MemberType>> =
						serde_json::from_str(&expected).expect("can't deserialize json");
					assert_eq!(expected, module_dump);
				} else {
					let json = serde_json::to_string_pretty(&module_dump).expect("can't serialize");
					fs::write(output_file, json).expect("can't write json");
				}
			}
		)+
	};
}

run_tests! {
    assigned_global,
    assigned_instantly,
    assigned_instantly_and_later,
    assigned_later,
    assigned_later_as_function,
    no_return,
	returns_but_nothing,
	returns_not_table,
}
