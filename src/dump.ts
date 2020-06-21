/*
* Code borrowed from roblox-ts/types, which is licensed under the MIT license.
*/
import * as request from "request-promise-native"
import * as vscode from "vscode"
import { parseStringPromise } from "xml2js"

const API_DUMP = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/API-Dump.json"
const REFLECTION_METADATA_URL = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/ReflectionMetadata.xml"

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

export interface ApiMemberBase {
    MemberType: string,
    Name: string,
    Security:
        | SecurityType
        | {
                Read: SecurityType,
                Write: SecurityType,
          },
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

/*
    Code borrowed from https://github.com/evaera/vscode-roblox-api-explorer/blob/master/src/api.ts
*/
async function injectDescriptions(classes: ApiClass[]) {
    const rmd = await parseStringPromise(
        await request(REFLECTION_METADATA_URL).catch((err) => {
            vscode.window.showErrorMessage("Error downloading API dump", err.toString())
        }),
    )

    for (const classEntry of classes) {
      const entry = rmd.roblox.Item.find(
        (i: any) => i.$.class === "ReflectionMetadataClasses",
      ).Item.find((i: any) =>
        i.Properties[0].string.find(
          (p: any) => p.$.name === "Name" && p._ === classEntry.Name,
        )
      )

      const summary = entry?.Properties[0].string.find(
        (s: any) => s.$.name === "summary",
      )?._

      if (entry && entry.Item) {
        const items = Object.fromEntries(
          entry.Item.flatMap((i: any) => i.Item)
            .filter((i: any) => i && i.Properties !== undefined)
            .map((i: any) => [
              i.Properties[0].string.find((s: any) => s.$.name === "Name")?._,
              i.Properties[0].string.find((s: any) => s.$.name === "summary")?._,
            ])
            .filter((entry: any) => entry.length === 2),
        )

        for (const member of classEntry.Members) {
          if (items[member.Name]) {
            member.Description = items[member.Name]
          }
        }
      }

      classEntry.Description = summary
    }
}

const apiDumpPromise = (async () => {
    const dump: ApiDump = JSON.parse(await request(API_DUMP).catch((err) => {
        vscode.window.showErrorMessage("Error downloading API dump", err.toString())
    }))
    await injectDescriptions(dump.Classes)
    return dump
})()

export function getApiDump(): Promise<ApiDump> {
    return apiDumpPromise
}
