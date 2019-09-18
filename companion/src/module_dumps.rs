use full_moon::{
    ast::{self, owned::Owned},
    visitors::Visitor,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub enum MemberType {
    Method,
    Function,
    Value,
}

fn extract_key_from_brackets(key: &ast::Expression) -> Option<String> {
    if let ast::Expression::Value { value, .. } = key {
        match **value {
            ast::Value::String(ref token) => {
                // Remove quotation marks
                let mut string = token.to_string();
                string.remove(0);
                string.pop();
                Some(string)
            }

            ast::Value::Number(ref token) | ast::Value::Symbol(ref token) => {
                Some(token.to_string())
            }

            _ => None,
        }
    } else {
        None
    }
}

fn member_type_from_value(value: &ast::Expression) -> MemberType {
    let mut member_type = MemberType::Value;

    if let ast::Expression::Value { value, .. } = value {
        if let ast::Value::Function(_) = **value {
            member_type = MemberType::Function;
        }
    }

    member_type
}

fn members_from_table(
    constructor: &ast::TableConstructor<'static>,
) -> BTreeMap<String, MemberType> {
    let mut map = BTreeMap::new();

    for (field, _) in constructor.iter_fields() {
        match field {
            ast::Field::ExpressionKey { key, value, .. } => {
                if let Some(key) = extract_key_from_brackets(&key) {
                    if !key.starts_with("__") {
                        map.insert(key, member_type_from_value(&value));
                    }
                }
            }

            ast::Field::NameKey { key, value, .. } => {
                let key = key.to_string();
                if !key.starts_with("__") {
                    map.insert(key, member_type_from_value(&value));
                }
            }

            _ => {}
        }
    }

    map
}

struct MemberVisitor {
    base_name: String,
    members: BTreeMap<String, MemberType>,
}

impl Visitor<'static> for MemberVisitor {
    fn visit_assignment(&mut self, assignment: &ast::Assignment<'static>) {
        let mut expr_list = assignment.expr_list().iter();

        for variable in assignment.var_list() {
            let assigned = expr_list.next();

            match variable {
                ast::Var::Expression(var_expr) => {
                    let prefix = match var_expr.prefix() {
                        ast::Prefix::Name(name) => name.to_string(),
                        _ => continue,
                    };

                    if prefix != self.base_name {
                        continue;
                    }

                    if let Some(suffix) = var_expr.iter_suffixes().next() {
                        let suffix = match suffix {
                            ast::Suffix::Call(_) => continue,
                            ast::Suffix::Index(index) => match index {
                                ast::Index::Brackets { expression, .. } => {
                                    extract_key_from_brackets(&expression)
                                }

                                ast::Index::Dot { name, .. } => Some(name.to_string()),
                            },
                        };

                        if let Some(suffix) = suffix {
                            // base_name.suffix = ...
                            // or base_name[suffix] = ...
                            let member_type = match assigned {
                                Some(value) => member_type_from_value(&value),
                                None => MemberType::Value,
                            };

                            self.members.insert(suffix, member_type);
                        }
                    }
                }

                ast::Var::Name(name) => {
                    if name.to_string() == self.base_name {
                        if let Some(ast::Expression::Value { value, .. }) = assigned {
                            if let ast::Value::TableConstructor(ref table) = **value {
                                self.members.extend(members_from_table(&table));
                            }
                        }
                    }
                }
            }
        }
    }

    fn visit_function_name(&mut self, function_name: &ast::FunctionName) {
        let mut names = function_name.names().iter();
        let base_name = names.next().expect("no base function name?");

        if base_name.to_string() != self.base_name {
            // code looks like:
            // function foo()
            // end
            // return Bar
            return;
        }

        let next_name = names.next();

        if let Some(next_name) = next_name {
            let next_name = next_name.to_string();

            // ignore internal names (function base_name.__index())
            if next_name.starts_with("__") {
                return;
            }

            // function base_name.next_name()
            if names.next().is_some() {
                // function base_name.next_name.something_else()
                self.members.insert(next_name, MemberType::Value);
            } else {
                // function base_name.next_name()
                self.members.insert(next_name, MemberType::Function);
            }
        } else if let Some(method_name) = function_name.method_name() {
            // function base_name:method()
            let method_name = method_name.to_string();

            if !method_name.starts_with("__") {
                self.members.insert(method_name, MemberType::Method);
            }
        }

        // otheriwse, it's `function base_name()`
    }

    fn visit_local_assignment(&mut self, local_assignment: &ast::LocalAssignment<'static>) {
        let mut expr_list = local_assignment.expr_list().iter();

        for name in local_assignment.name_list() {
            let expr = expr_list.next();

            if name.to_string() == self.base_name {
                if let Some(ast::Expression::Value { value, .. }) = expr {
                    if let ast::Value::TableConstructor(ref table) = **value {
                        self.members.extend(members_from_table(&table));
                    }
                }
            }
        }
    }
}

pub fn generate_module_dump(
    code: &str,
) -> Result<Option<BTreeMap<String, MemberType>>, full_moon::Error<'static>> {
    let ast = full_moon::parse(code)
        .as_ref()
        .map_err(Owned::owned)?
        .owned();
    let return_name = match ast.nodes().last_stmts() {
        Some(last_stmt) => {
            match last_stmt {
                ast::LastStmt::Return(stmt) => {
                    let first_return = match stmt.returns().iter().next() {
                        Some(value) => value,
                        // They used return, but not return nil
                        None => return Ok(None),
                    };

                    match first_return {
                        // TODO: Support parentheses, aka `return (Data)`

                        // Most likely return name
                        ast::Expression::Value { value, binop } => {
                            if binop.is_some() {
                                // This happens with something like return 3 + 5
                                // There's no scenario where this gives us a table
                                return Ok(None);
                            }

                            match **value {
                                // return { ... }
                                ast::Value::TableConstructor(ref table) => {
                                    return Ok(Some(members_from_table(table)));
                                }

                                // return name, probably
                                ast::Value::Var(ref var) => match var {
                                    ast::Var::Name(name) => name,
                                    _ => return Ok(None),
                                },

                                _ => return Ok(None),
                            }
                        }

                        _ => return Ok(None),
                    }
                }

                // Last statement isn't a return
                _ => return Ok(None),
            }
        }

        // No return value!
        None => return Ok(None),
    };

    let mut member_visitor = MemberVisitor {
        base_name: return_name.to_string(),
        members: BTreeMap::new(),
    };

    member_visitor.visit_ast(&ast);
    Ok(Some(member_visitor.members))
}

#[cfg(test)]
mod tests {
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

					let module_dump = super::generate_module_dump(&source)
						.expect("can't generate module dump");

					let output_file = format!("./tests/module_dumps/{}.json", stringify!($module_name));

					if let Ok(expected) = fs::read_to_string(&output_file) {
						let expected: Option<BTreeMap<String, super::MemberType>> =
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
}
