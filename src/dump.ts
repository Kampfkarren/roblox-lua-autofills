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
    Description?: string,
}

export interface ApiEnum {
    Items: Array<ApiEnumItem>,
    Name: string,
    Description?: string,
}

export interface ApiDump {
    Classes: Array<ApiClass>,
    Enums: Array<ApiEnum>,
    Version: number,
}

interface RMDStringProperty {
    _: string,
    $: {
        name: string,
    },
}

interface RMDPropertyHolder {
    string: RMDStringProperty[],
}

interface RMDItem {
    $: {
        class: "ReflectionMetadataClass" | "ReflectionMetadataYieldFunctions" | "ReflectionMetadataMember" | "ReflectionMetadataCallbacks" | "ReflectionMetadataEnum",
    },
    Properties: RMDPropertyHolder[],
    Item?: RMDItem[],
}

interface RMDParentItem {
    $: {
        class: "ReflectionMetadataClasses" | "ReflectionMetadataEnums",
    },
    Properties: string[],
    Item: RMDItem[],
}

interface RMDump {
    roblox: {
        Item: RMDParentItem[],
    },
}

/*
    Code based on https://github.com/evaera/vscode-roblox-api-explorer/blob/master/src/api.ts
*/
function createDescribedClasses(rmd: RMDump, classes: ApiClass[]): ApiClass[] {
    const describedClasses: ApiClass[] = []

    for (const classEntry of classes) {
        const entry = rmd.roblox.Item.find(
            item => item.$.class === "ReflectionMetadataClasses",
        )?.Item.find(item =>
            item.Properties[0].string.find(
                property => property.$.name === "Name" && property._ === classEntry.Name,
            ),
        )

        const summary = entry?.Properties[0].string.find(
            property => property.$.name === "summary",
        )?._

        const describedMembers: ApiMember[] = []

        if (entry !== undefined && entry.Item !== undefined) {
            const items: { [name: string]: string } = Object.fromEntries(
                entry.Item.flatMap(item => item.Item)
                    .filter<RMDItem>(
                        (item: RMDItem | undefined): item is RMDItem => item !== undefined && item.Properties !== undefined)
                    .map(item => [
                        item.Properties[0].string.find(property => property.$.name === "Name")?._,
                        item.Properties[0].string.find(property => property.$.name === "summary")?._,
                    ])
                    .filter(output => output.length === 2),
            )

            for (const member of classEntry.Members) {
                const describedMember: ApiMember = Object.assign({}, member)

                if (items[member.Name] !== undefined) {
                    describedMember.Description = items[member.Name]
                }

                describedMembers.push(describedMember)
            }
        }

        describedClasses.push({
            ...classEntry,
            Description: summary,
            Members: describedMembers,
        })
    }

    return describedClasses
}

function createDescribedEnums(rmd: RMDump, enums: ApiEnum[]): ApiEnum[] {
    const describedEnums: ApiEnum[] = []

    for (const enumEntry of enums) {
        const entry = rmd.roblox.Item.find(
            item => item.$.class === "ReflectionMetadataEnums",
        )?.Item.find(item =>
            item.Properties[0].string.find(
                property => property.$.name === "Name" && property._ === enumEntry.Name,
            ),
        )

        const summary = entry?.Properties[0].string.find(
            property => property.$.name === "summary",
        )?._

        const describedEnumItems = [...enumEntry.Items]

        if (entry !== undefined && entry.Item !== undefined) {
            const items: { [name: string]: string } = Object.fromEntries(
                entry.Item
                    .filter<RMDItem>(
                        (item: RMDItem | undefined): item is RMDItem => item !== undefined && item.Properties !== undefined)
                    .map(item => [
                        item.Properties[0].string.find(property => property.$.name === "Name")?._,
                        item.Properties[0].string.find(property => property.$.name === "summary")?._,
                    ])
                    .filter(output => output.length === 2),
            )

            for (const item of describedEnumItems) {
                if (items[item.Name] !== undefined) {
                    item.Description = items[item.Name]
                }
            }
        }

        describedEnums.push({
            Name: enumEntry.Name,
            Items: describedEnumItems,
            Description: summary,
        })
    }

    return describedEnums
}

async function createDescribedDump(dump: ApiDump): Promise<ApiDump> {
    const rmd: RMDump = await parseStringPromise(
        await request(REFLECTION_METADATA_URL).catch((err) => {
            vscode.window.showErrorMessage("Error downloading API dump", err.toString())
        }),
    )

    const describedClasses = createDescribedClasses(rmd, dump.Classes)
    const describedEnums = createDescribedEnums(rmd, dump.Enums)

    return {
        Classes: describedClasses,
        Enums: describedEnums,
        Version: dump.Version,
    }
}

const apiDumpPromise = (async () => {
    const dump: ApiDump = JSON.parse(await request(API_DUMP).catch((err) => {
        vscode.window.showErrorMessage("Error downloading API dump", err.toString())
    }))
    return await createDescribedDump(dump)
})()

export function getApiDump(): Promise<ApiDump> {
    return apiDumpPromise
}
