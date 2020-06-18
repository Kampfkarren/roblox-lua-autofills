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

        const hsv = this.rgbToHsv(r, g, b)

        return [
            new vscode.ColorPresentation(`Color3.fromRGB(${r * 255}, ${g * 255}, ${b * 255})`),
            new vscode.ColorPresentation(`Color3.new(${r}, ${g}, ${b})`),
            new vscode.ColorPresentation(`Color3.fromHSV(${hsv.h}, ${hsv.s}, ${hsv.v})`),
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
                    case "fromHSV":
                        const rgb = this.hsvToRgb(values[0], values[1], values[2])

                        colors.push(new vscode.ColorInformation(
                            new vscode.Range(lineNo, colorMatch.index, lineNo, colorRegex.lastIndex),
                            new vscode.Color(rgb.r, rgb.g, rgb.b, 1),
                        ))
                        break
                }
            }
        }

        return colors
    }

    private rgbToHsv(red: number, green: number, blue: number) {
        const v = Math.max(red, green, blue)
        const n = v - Math.min(red, green, blue)
        const h = n && (
            (v === red) ? (green - blue) / n : ((v === green) ? 2 + (blue - red) / n : 4 + (red - green) / n)
        )

        return {
            h: 60 * (h < 0 ? h + 6 : h),
            s: v && n / v,
            v,
        }
    }

    private hsvToRgb(h: number, s: number, v: number) {
        const i = Math.floor(h * 6)
        const f = h * 6 - i
        const p = v * (1 - s)
        const q = v * (1 - f * s)
        const t = v * (1 - (1 - f) * s)

        let r = 0
        let g = 0
        let b = 0

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break
            case 1: r = q, g = v, b = p; break
            case 2: r = p, g = v, b = t; break
            case 3: r = p, g = q, b = v; break
            case 4: r = t, g = p, b = v; break
            case 5: r = v, g = p, b = q; break
        }

        return {
            r,
            g,
            b,
        }
    }
}
