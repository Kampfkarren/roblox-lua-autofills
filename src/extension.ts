// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as request from "request-promise-native"
import * as vscode from "vscode"

const API_DUMP = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"
const UNCREATABLE_TAGS = new Set([
    "Deprecated",
    "NotBrowsable",
    "NotCreatable",
    "Service",
    "Settings",
])

interface IApiDump {
    Classes: IClass[],
    Enums: IEnum[],
}

interface IClass {
    Name: string,
    Tags?: string,
}

interface IEnum {
    Items: IEnumItem[],
    Name: string,
}

interface IEnumItem {
    Name: string,
    Value: number,
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    console.log("roblox-lua-autofills activated")

    const apiDump: IApiDump = JSON.parse(await request(API_DUMP).catch((err) => {
        vscode.window.showErrorMessage("Error downloading API dump", err.toString())
    }))

    const instanceNamesSnippet = new vscode.CompletionItem(
        "Instance.new",
        vscode.CompletionItemKind.Snippet,
    )

    const snippetString = new vscode.SnippetString("Instance.new(\"")
    snippetString.value += "${1|" + apiDump.Classes.filter((klass) => {
        const tags = klass.Tags
        if (tags) {
            for (const tag of tags) {
                if (UNCREATABLE_TAGS.has(tag)) {
                    return false
                }
            }
        }

        return true
    }).map((klass) => klass.Name).sort().join(",") + "|}\")" // https://github.com/Microsoft/vscode/issues/43643
    instanceNamesSnippet.insertText = snippetString

    const enumItems = apiDump.Enums.map((eenum) => new vscode.CompletionItem(eenum.Name))

    const enumNamesAndItems: { [name: string]: vscode.CompletionItem[] } = {}
    for (const eenum of apiDump.Enums) {
        enumNamesAndItems[eenum.Name] = eenum.Items.map((item) => new vscode.CompletionItem(item.Name))
    }

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: "file", language: "lua"}, {
        provideCompletionItems(document, position, cancel, completionContext) {
            const textSplit = document.lineAt(position.line).text.substr(0, position.character).split(/\s+/)
            const text = textSplit[textSplit.length - 1]
            if (text !== undefined && text.startsWith("Enum.")) {
                const tokens = text.split(".")
                if (tokens.length === 1 || tokens.length === 2) {
                    // Enum. or Enum.EnumNameButIHaventFinishedYet
                    return enumItems
                } else if (tokens.length === 3) {
                    // Enum.Name.NowImTypingThis
                    const enumName = tokens[1]
                    const items = enumNamesAndItems[enumName]
                    return items || []
                }
            }

            return [
                instanceNamesSnippet,
            ]
        },
    }, "."))
}
