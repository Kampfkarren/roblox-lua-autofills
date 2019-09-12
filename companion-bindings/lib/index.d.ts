export enum MemberType {
	Method = "Method",
	Function = "Function",
	Value = "Value",
}

export function generateModuleDump(code: string): [[string, MemberType]];
