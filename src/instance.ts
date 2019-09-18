import * as vscode from "vscode"
import { getApiDump, UNCREATABLE_TAGS } from "./dump"

export class InstanceCompletionProvider implements vscode.CompletionItemProvider {
    snippet: Promise<vscode.CompletionItem>

    constructor() {
        this.snippet = (async () => {
            const apiDump = await getApiDump()
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

            return instanceNamesSnippet
        })()
    }

    async provideCompletionItems() {
        return [await this.snippet]
    }
}
