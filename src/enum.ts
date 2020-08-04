import * as vscode from "vscode"
import { getApiDump } from "./dump"

export class EnumCompletionProvider implements vscode.CompletionItemProvider {
    enumItems: Promise<vscode.CompletionItem[]>
    enumNamesAndItems: Promise<{ [name: string]: vscode.CompletionItem[] }>
    enumProperties = [
        new vscode.CompletionItem("Name", vscode.CompletionItemKind.Field),
        new vscode.CompletionItem("Value", vscode.CompletionItemKind.Field),
    ]

    constructor() {
        this.enumItems = (async () => {
            const apiDump = await getApiDump()

            return apiDump.Enums
                .map(eenum => {
                    const completionItem = new vscode.CompletionItem(eenum.Name, vscode.CompletionItemKind.Enum)
                    completionItem.documentation = new vscode.MarkdownString(`${eenum.Description ? eenum.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/enum/${eenum.Name})`)
                    return completionItem
                })
        })()

        this.enumNamesAndItems = (async () => {
            const apiDump = await getApiDump()
            const enumNamesAndItems: { [name: string]: vscode.CompletionItem[] } = {}

            for (const eenum of apiDump.Enums) {
                enumNamesAndItems[eenum.Name] = eenum.Items.map(item => {
                        const completionItem = new vscode.CompletionItem(item.Name,
                            vscode.CompletionItemKind.EnumMember)
                        completionItem.documentation = new vscode.MarkdownString(`${item.Description ? item.Description + "\n\n" : ""}[Developer Reference](https://developer.roblox.com/en-us/api-reference/enum/${eenum.Name})`)
                        return completionItem
                    })
            }

            return enumNamesAndItems
        })()
    }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const textSplit = document.lineAt(position.line).text.substr(0, position.character).split(/[^\w\.]+/)
        const text = textSplit[textSplit.length - 1]

        if (text !== undefined && text.startsWith("Enum.")) {
            const tokens = text.split(".")
            if (tokens.length === 1 || tokens.length === 2) {
                // Enum. or Enum.EnumNameButIHaventFinishedYet
                return this.enumItems
            } else if (tokens.length === 3) {
                // Enum.Name.NowImTypingThis
                const enumName = tokens[1]
                const items = (await this.enumNamesAndItems)[enumName]
                return items || []
            } else if (tokens.length === 4) {
                // Enum.Name.EnumMember.NowImTypingThis
                return this.enumProperties
            }
        }
    }
}
