import * as vscode from "vscode"

export class RobloxColorProvider implements vscode.DocumentColorProvider {
    public provideColorPresentations(
        color: vscode.Color,
        context: { document: vscode.TextDocument, range: vscode.Range },
        cancel: vscode.CancellationToken,
    ) {
        const r = color.red
        const g = color.green
        const b = color.blue

        return [
            new vscode.ColorPresentation(`Color3.fromRGB(${r * 255}, ${g * 255}, ${b * 255})`),
            new vscode.ColorPresentation(`Color3.new(${r}, ${g}, ${b})`),
        ]
    }

    public provideDocumentColors(document: vscode.TextDocument, cancel: vscode.CancellationToken) {
        const colorRegex = /Color3\.([A-Za-z]+)\(\s*([0-9.]+),\s*([0-9.]+),\s*([0-9]+)\)/g
        const colors = []

        for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
            const text = document.lineAt(lineNo).text

            while (true) {
                const colorMatch = colorRegex.exec(text)
                if (colorMatch === null) {
                    break
                }

                const operation = colorMatch[1]
                const values = colorMatch.slice(2).map(Number)

                switch (operation) {
                    case "new":
                        colors.push(new vscode.ColorInformation(
                            new vscode.Range(lineNo, colorMatch.index, lineNo, colorRegex.lastIndex),
                            new vscode.Color(values[0], values[1], values[2], 1),
                        ))
                        break
                    case "fromRGB":
                        colors.push(new vscode.ColorInformation(
                            new vscode.Range(lineNo, colorMatch.index, lineNo, colorRegex.lastIndex),
                            new vscode.Color(values[0] / 255, values[1] / 255, values[2] / 255, 1),
                        ))
                        break
                }
            }
        }

        return colors
    }
}
