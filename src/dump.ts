/*
* Code borrowed from roblox-ts/types, which is licensed under the MIT license.
*/
import * as request from "request-promise-native"
import * as vscode from "vscode"

const API_DUMP = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"

export const UNCREATABLE_TAGS = new Set([
    "Deprecated",
    "NotBrowsable",
    "NotCreatable",
    "Service",
    "Settings",
])

export interface ApiParameter {
    Name: string,
    Type: ApiValueType,
    Default?: string,
}

export type SecurityType =
    | "None"
    | "LocalUserSecurity"
    | "PluginSecurity"
    | "RobloxScriptSecurity"
    | "RobloxSecurity"
    | "NotAccessibleSecurity"

export type MemberCategoryType =
    | "instance/object"
    | "animation/instance"
    | "instance/mesh"
    | "render/decal"
    | "instance/gui"
    | "physics/joint"
    | "lua/script"
    | "instance/part"
    | "sound/default"

export type CategoryType =
    | "Appearance"
    | "Attachments"
    | "Behavior"
    | "Camera"
    | "Compliance"
    | "Data"
    | "Derived Data"
    | "Goals"
    | "Image"
    | "Shape"
    | "Thrust"
    | "Turn"

export type ClassTag =
    | "Deprecated"
    | "NotBrowsable"
    | "NotCreatable"
    | "NotReplicated"
    | "PlayerReplicated"
    | "Service"
    | "Settings"

export type MemberTag =
    | "CanYield"
    | "CustomLuaState"
    | "Deprecated"
    | "Hidden"
    | "NotBrowsable"
    | "NotReplicated"
    | "NotScriptable"
    | "ReadOnly"
    | "Yields"

export interface ApiPropertySecurity {
    Read: SecurityType,
    Write: SecurityType,
}

export interface ApiMemberBase {
    MemberType: string,
    Name: string,
    Security:
        | SecurityType
        | ApiPropertySecurity,
    Tags?: Array<MemberTag>,
    Description?: string,
}

export interface ApiValueType {
    Category: "Primitive" | "Class" | "DataType" | "Enum" | "Group",
    Name: string,
}

export interface ApiProperty extends ApiMemberBase {
    MemberType: "Property",
    Category: CategoryType,
    Serialization: {
        CanLoad: boolean,
        CanSave: boolean,
    },
    ValueType: ApiValueType,
}

export interface ApiFunction extends ApiMemberBase {
    MemberType: "Function",
    Parameters: Array<ApiParameter>,
    ReturnType: ApiValueType,
}

export interface ApiEvent extends ApiMemberBase {
    MemberType: "Event",
    Parameters: Array<ApiParameter>,
}

export interface ApiCallback extends ApiMemberBase {
    MemberType: "Callback",
    Parameters: Array<ApiParameter>,
}

export type ApiMember = ApiProperty | ApiFunction | ApiEvent | ApiCallback

export interface ApiClass {
    Members: Array<ApiMember>,
    MemoryCategory: MemberCategoryType,
    Tags?: Array<ClassTag>,
    Name: string,
    Superclass: string,
    Subclasses: Array<string>,
    Description?: string,
}

export interface ApiEnumItem {
    Name: string,
    Value: number,
}

export interface ApiEnum {
    Items: Array<ApiEnumItem>,
    Name: string,
}

export interface ApiDump {
    Classes: Array<ApiClass>,
    Enums: Array<ApiEnum>,
    Version: number,
}

let apiDumpPromise = (async () => {
    return JSON.parse(await request(API_DUMP).catch((err) => {
        vscode.window.showErrorMessage("Error downloading API dump", err.toString())
    })) as ApiDump
})()

export function getApiDump(): Promise<ApiDump> {
    return apiDumpPromise
}
