import * as vscode from "vscode"
import { ApiEnum, getApiDump } from "./dump"

export class EnumCompletionProvider implements vscode.CompletionItemProvider {
    public enumItems: Promise<vscode.CompletionItem[]>
    public enumNamesAndItems: Promise<{ [name: string]: vscode.CompletionItem[] }>
    public enumProperties = [
        new vscode.CompletionItem("Name", vscode.CompletionItemKind.Field),
        new vscode.CompletionItem("Value", vscode.CompletionItemKind.Field),
    ]

    constructor() {
        this.enumItems = (async () => {
            const apiDump = await getApiDump()

            return apiDump.Enums
                .map((eenum: ApiEnum) => new vscode.CompletionItem(
                    eenum.Name,
                    vscode.CompletionItemKind.Enum,
                ))
        })()

        this.enumNamesAndItems = (async () => {
            const apiDump = await getApiDump()
            const enumNamesAndItems: { [name: string]: vscode.CompletionItem[] } = {}

            for (const eenum of apiDump.Enums) {
                enumNamesAndItems[eenum.Name] = eenum.Items.map(
                    (item) => new vscode.CompletionItem(item.Name, vscode.CompletionItemKind.EnumMember))
            }

            return enumNamesAndItems
        })()
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
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
