const companion = require("../companion/pkg/companion")

export enum MemberType {
	Function = "Function",
	Method = "Method",
	Value = "Value",
}

// wasm-pack creates incorrect type bindings
export function generateModuleDump(code: string): [[string, MemberType]] | undefined {
	return companion.generate_module_dump_js(code)
}

// Don't want to build the companion? It's not necessary, comment the above functions
// ...as well as the import and uncomment this stub code:

// export function generateModuleDump(code: string): [[string, MemberType]] {
// 	return []
// }
