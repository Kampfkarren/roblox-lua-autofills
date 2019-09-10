const API_DUMP = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"

import * as request from "request-promise-native"
import * as vscode from "vscode"

export const UNCREATABLE_TAGS = new Set([
    "Deprecated",
    "NotBrowsable",
    "NotCreatable",
    "Service",
    "Settings",
])

export interface IApiDump {
    Classes: IClass[],
    Enums: IEnum[],
}

export interface IClass {
    Name: string,
    Tags?: string[],
}

export interface IEnum {
    Items: IEnumItem[],
    Name: string,
}

export interface IEnumItem {
    Name: string,
    Value: number,
}

let apiDumpPromise = (async () => {
	return JSON.parse(await request(API_DUMP).catch((err) => {
        vscode.window.showErrorMessage("Error downloading API dump", err.toString())
    })) as IApiDump
})()

export function getApiDump(): Promise<IApiDump> {
	return apiDumpPromise
}
