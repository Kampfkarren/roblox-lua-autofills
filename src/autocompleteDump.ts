import * as request from "request-promise-native"
import * as vscode from "vscode"
import { parseStringPromise } from "xml2js"

const AUTOCOMPLETE_METADATA = "https://raw.githubusercontent.com/CloneTrooper1019/Roblox-Client-Tracker/roblox/AutocompleteMetadata.xml"

export interface AutocompleteParameter {
    type: string,
    name: string,
    optional: boolean,
}

export interface AutocompleteReturn {
    type: string,
    name?: string,
}

export interface AutocompleteFunction {
    name: string,
    static: boolean,
    description?: string,
    parameters: AutocompleteParameter[],
    returns: AutocompleteReturn[],
}

export interface AutocompleteProperty {
    name: string,
    static: boolean,
    type: string,
    description?: string,
}

export interface AutocompleteGroup {
    name: string,
    functions: AutocompleteFunction[],
    properties: AutocompleteProperty[],
}

export interface AutocompleteDump {
    LuaLibrary: AutocompleteGroup[],
    ItemStruct: AutocompleteGroup[],
}

// Interfaces for the data provided in the XML parser
interface XMLPropertyPart {
    _: string, // Description
    $: {
        name: string,
        static?: string,
    }
}

interface XMLOrderedPropertyPart extends XMLPropertyPart {
    "#name": string // Property type
}

interface XMLProperty {
    $$: XMLOrderedPropertyPart[],
    [name: string]: XMLPropertyPart[]
}

interface XMLFunctionReturnPart {
    $?: {
        name?: string,
    }
}
interface XMLOrderedFunctionReturnPart extends XMLFunctionReturnPart { "#name": string }

interface XMLFunctionParameterPart {
    $: {
        name: string,
        constraint?: string,
        optional?: string,
    },
}
interface XMLOrderedFunctionParameterPart extends XMLFunctionParameterPart { "#name": string }

interface XMLFunction {
    $: {
        name: string,
        static: string,
    },
    $$: [], // Shouldn't really be used
    returns: Array<{
        $$: XMLOrderedFunctionReturnPart[],
        [name: string]: XMLFunctionReturnPart[],
    }>,
    parameters: Array<{
        $$: XMLOrderedFunctionParameterPart[],
        [name: string]: XMLFunctionParameterPart[],
    }>,
    description: string[],
}

interface XMLGroup {
    $: {
        name: string,
    },
    $$: [], // Shouldnt be used
    Function?: XMLFunction[],
    Properties?: XMLProperty[],
}

interface XMLTree {
    StudioAutocomplete: {
        LuaLibrary: XMLGroup[],
        ItemStruct: XMLGroup[],
        CoreLibrary: XMLGroup[]
        ReservedWords: Array<{
            $$: Array<{
                $: {
                    name: string,
                },
                "#name": string,
            }>,
            Keyword: Array<{
                $: {
                    name: string,
                },
            }>,
        }>,
    }
}

const formatFunction = (func: XMLFunction): AutocompleteFunction => {
    const attributes = func.$
    const parameters: AutocompleteParameter[] =
        (func.parameters && func.parameters[0].$$) ? func.parameters[0].$$.map(paramObj => {
            const type = paramObj["#name"]
            const parameterAttributes = paramObj.$
            return {
                name: parameterAttributes.name,
                optional: parameterAttributes.optional === "true",
                type,
            }
        }) : []

    const returns = (func.returns && func.returns[0].$$) ? func.returns[0].$$.map(ret => {
        const type = ret["#name"]
        const returnAttributes = ret.$
        return {
            name: returnAttributes?.name,
            type,
        }
    }) : []

    return {
        description: func.description && func.description[0],
        name: attributes.name,
        parameters,
        returns,
        static: attributes.static === "true",
    }
}

const formatProperty = (property: XMLOrderedPropertyPart): AutocompleteProperty => {
    const description = property._
    const type = property["#name"]
    const attributes = property.$
    return {
      description,
      name: attributes.name,
      static: attributes.static === "true",
      type,
    }
}

const formatGroup = (group: XMLGroup): AutocompleteGroup => {
    return {
      functions: group.Function ? group.Function.map(formatFunction) : [],
      name: group.$.name,
      properties: (group.Properties && group.Properties[0].$$) ? group.Properties[0].$$.map(formatProperty) : [],
    }
}

const formatter = (tree: XMLTree): AutocompleteDump => {
    const root = tree.StudioAutocomplete
    const LuaLibrary = root.LuaLibrary
    const ItemStruct = root.ItemStruct

    const updatedLibrary = LuaLibrary.map(formatGroup)
    const updatedItemStruct = ItemStruct.map(formatGroup)

    return {
      ItemStruct: updatedItemStruct,
      LuaLibrary: updatedLibrary,
    }
}

const autocompleteMetadataPromise = (async () => {
    const data = await request(AUTOCOMPLETE_METADATA).catch((err) => {
        vscode.window.showErrorMessage("Error downloading Autocomplete Metadata dump", err.toString())
    })
    const output = await parseStringPromise(data, {
        explicitChildren: true,
        preserveChildrenOrder: true,
        trim: true,
    })

    return formatter(output)
})()

export function getAutocompleteDump(): Promise<AutocompleteDump> {
    return autocompleteMetadataPromise
}
