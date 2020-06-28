// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { RobloxColorProvider } from "./color"
import { Companion } from "./companion"
import { EnumCompletionProvider } from "./enum"
import { InstanceCompletionProvider } from "./instance"
import { RoactCompletionProvider } from "./roact"
import { RojoHandler } from "./rojo"
import { ServiceCompletionProvider } from "./services"
const SELECTOR = { scheme: "file", language: "lua" }

export async function activate(context: vscode.ExtensionContext) {
    console.log("roblox-lua-autofills activated")

    let rojoHandler: RojoHandler | undefined

    if (vscode.workspace.workspaceFolders !== undefined
        && vscode.workspace.getConfiguration("robloxLuaAutofills").get("rojo"))
    {
        rojoHandler = new RojoHandler()
        context.subscriptions.push(rojoHandler)
    }

    context.subscriptions.push(new Companion(context))

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("robloxLuaAutofills.rojo")) {
            if (vscode.workspace.getConfiguration("robloxLuaAutofills").get("rojo")) {
                rojoHandler = new RojoHandler()
                context.subscriptions.push(rojoHandler)
            } else {
                if (rojoHandler) {
                    rojoHandler.dispose()
                }
            }
        }
    }))

    context.subscriptions.push(vscode.languages.registerColorProvider(SELECTOR, new RobloxColorProvider()))

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(SELECTOR, new InstanceCompletionProvider(), "."))
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(SELECTOR, new EnumCompletionProvider(), "."))
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(SELECTOR, new ServiceCompletionProvider(), ".", ":"))
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(SELECTOR, new RoactCompletionProvider(), "."))
}
