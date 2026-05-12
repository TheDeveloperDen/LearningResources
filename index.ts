import path from "path";
import { parseArgs } from "util";
import { z } from "zod";
import fs from "node:fs";
import {
    extendZodWithOpenApi,
    OpenAPIRegistry,
    OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const topicsDir = path.join(__dirname, "./metadata/topics");
const languagesDir = path.join(__dirname, "./metadata/languages");

export const fileNameToId = (fileName: string) => path.basename(fileName, ".yaml");

const validTopics = fs.readdirSync(topicsDir, { recursive: true })
    .filter(f => typeof f === 'string' && f.endsWith(".yaml"))
    .map(f => fileNameToId(f as string));

const validLanguages = fs.readdirSync(languagesDir, { recursive: true })
    .filter(f => typeof f === 'string' && f.endsWith(".yaml"))
    .map(f => fileNameToId(f as string))

const allValidTags = [...validTopics, ...validLanguages];

if (allValidTags.length === 0) {
    throw new Error("No metadata entities found!");
}

const EntityTagEnum = z.enum([
    allValidTags[0],
    ...allValidTags.slice(1)
] as [string, ...string[]]);


const PaidPricingSchema = z.strictObject({
    model: z
        .enum(["Subscription", "One Time"])
        .describe(
            "The Paid Pricing Model of this resource. 'Subscription' means the resource is paid on a recurring basis (e.g. monthly or yearly), while 'One Time' means the resource is paid with a single upfront payment. If the price varies or is not fixed, provide a close approximation. Note that the subscription renewal cycle is not specified, so if the price has different renewal cycles, provide the most common or default one (usually monthly).",
        ),
    amount: z
        .number()
        .gt(0)
        .describe("The price of this resource, in US Dollars."),
}).meta({ id: "PaidPricing" });

const FreePricingSchema = z.strictObject({
    model: z
        .enum(["Free", "Freemium"])
        .describe(
            "The Free(mium) Pricing Model of this resource. 'Free' should be used for resources where 100% (or close) of the content is free. 'Freemium' describes a pricing model where the core content is available for free, but features paid extensions. If the resource has a freemium model but the free portion is very limited, consider using 'Paid' instead and providing an estimated price for the full version. ",
        ),
}).meta({ id: "FreePricing" });

/**
 * The Pricing of a Resource, which can either be Free/Freemium or Paid (Subscription/One Time)
 */
const PricingSchema = z
    .discriminatedUnion("model", [
        FreePricingSchema,
        PaidPricingSchema,
    ])
    .meta({ id: "Pricing" })
    .describe("Details about the cost of the resource.");

export const LanguageDomainSchema = z
    .enum([
        "Web Development",
        "Data Science",
        "Mobile Development",
        "Game Development",
        "Systems Programming",
        "Scripting",
        "General Purpose",
        "DevOps"
    ])
    .describe("A domain that a programming language may be used in.");

export const ProgrammingParadigmSchema = z
    .enum([
        "Object-Oriented Programming",
        "Functional Programming",
        "Procedural Programming",
        "Logic Programming",
    ])
    .describe("A programming paradigm.");

export const ResourceCategorySchema = z
    .discriminatedUnion("type", [
        z.object({
            type: z.literal("Language"),
            paradigms: z
                .array(ProgrammingParadigmSchema)
                .describe(
                    "The programming paradigms that this language focuses on, e.g. 'Object-Oriented Programming', 'Functional Programming', 'Procedural Programming', etc.",
                ),
        }),
        z.object({
            type: z.literal("Platform"),
        }).describe(
            "A platform used to learn programming, which may teach a variety of languages and concepts.",
        ),
        z.object({
            type: z.literal("Tool"),
        })
    ])
    .describe("The category of the resource");

const ResourceTypeSchema = z.enum(["Video", "Article", "Interactive Tutorial", "Book", "Course"]).describe(
    "The type of the resource",
);

export const ResourceSchema = z.object({
    name: z.string().describe("The official name of the resource"),
    description: z
        .string()
        .max(256)
        .optional()
        .describe("A brief description of the resource"),
    url: z.url().describe("URL to the resource"),
    type: z.array(ResourceTypeSchema).min(1, "Must specify at least one resource type").describe("The type(s) of the resource, e.g. 'Video', 'Book', 'Course', etc."),
    teaches: z.array(EntityTagEnum)
        .min(1, "Must teach at least one topic")

        .describe("The topics that this resource teaches."),
    pricing: PricingSchema,
    pros: z
        .array(z.string())
        .optional()
        .describe(
            "Array of pros for using the resource, e.g. 'explains difficult concepts with good analogies'",
        ),
    cons: z
        .array(z.string())
        .optional()
        .describe(
            "Array of cons for using the resource, e.g. 'only teaches the basics rather than more advanced concepts'",
        ),
}).strict();


export const MetaSchema = z.object({
    name: z
        .string()
        .describe(
            "The name of the language, tool, etc being described by this metadata.",
        ),
    description: z
        .string()
        .describe(
            "A brief description of the language, tool, etc being described by this metadata.",
        ),
    emoji: z
        .string()
        .optional()
        .describe(
            "A Unicode emoji glyph to represent the entity, if applicable. If there is no suitable (Unicode) emoji, omit this field. Consumers may choose to ignore this field, or replace it with a custom image.",
        ),
    domains: z
        .array(LanguageDomainSchema)
        .describe(
            "The domain(s) that the entity is commonly used in, or best suited for.",
        ),
    category: ResourceCategorySchema,
}).strict();

export const CompiledMetaSchema = MetaSchema.extend({
    id: EntityTagEnum.describe("The unique identifier of the entity"),
}).strict();

export const DatabaseSchema = z.object({
    metadata: z.array(CompiledMetaSchema).describe("List of all entities in the system"),
    resources: z.array(ResourceSchema).describe("List of all learning resources"),
}).strict();

export type Meta = z.infer<typeof MetaSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Database = z.infer<typeof DatabaseSchema>;

function main() {
    const header = "// Generated by index.ts - DO NOT EDIT THIS FILE DIRECTLY";

    const { values, positionals: _ } = parseArgs({
        args: Bun.argv,
        options: {
            schema: {
                type: "string",
            },
        },
        strict: true,
        allowPositionals: true,
    });

    const schemaArg = values.schema?.toLowerCase();
    if (schemaArg === "openapi") {
        const registry = new OpenAPIRegistry();
        registry.register("EntityTag", EntityTagEnum);
        registry.register("Pricing", PricingSchema);
        registry.register("ResourceCategory", ResourceCategorySchema);
        registry.register("CompiledMeta", CompiledMetaSchema);
        registry.register("Resource", ResourceSchema);
        registry.register("Database", DatabaseSchema);
        const generator = new OpenApiGeneratorV3(registry.definitions);
        const document = generator.generateDocument({
            openapi: "3.0.0",
            info: {
                version: "1.0.0",
                title: "Learning Resources Database Schema",
                description: header,
            },
        });

        console.log(JSON.stringify(document, null, 2));
        process.exit(0);
    }

    let schema: z.ZodObject;
    switch (schemaArg) {
        case "metadata":
            schema = MetaSchema;
            break;
        case "resource":
            schema = ResourceSchema;
            break;
        case "database":
            schema = DatabaseSchema;
            break;
        case undefined:
            console.error("No schema specified. Use --schema to specify which schema to generate (e.g. --schema resource)");
            process.exit(1);
        default:
            console.error(`Unknown schema: ${values.schema}`);
            process.exit(1);
    }

    const jsonSchema = z.toJSONSchema(schema, { reused: "inline", });
    jsonSchema.$comment = header;
    console.log(JSON.stringify(jsonSchema, null, 2));
}

if (import.meta.main) {
    main();
}

