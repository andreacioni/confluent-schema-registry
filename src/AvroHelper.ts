import {
  AvroSchema,
  RawAvroSchema,
  AvroOptions,
  ConfluentSchema,
  SchemaHelper,
  ConfluentSubject,
  ReferenceType,
  AvroConfluentSchema,
  ProtocolOptions,
} from './@types'
import { ConfluentSchemaRegistryArgumentError } from './errors'
import avro from 'avsc'
import { SchemaResponse, SchemaType } from './@types'

export default class AvroHelper implements SchemaHelper {
  private getRawAvroSchema(schema: ConfluentSchema): RawAvroSchema {
    return (typeof schema.schema === 'string'
      ? JSON.parse(schema.schema)
      : schema.schema) as RawAvroSchema
  }

  public getAvroSchema(schema: ConfluentSchema | RawAvroSchema, opts?: AvroOptions) {
    const rawSchema: RawAvroSchema = this.isRawAvroSchema(schema)
      ? schema
      : this.getRawAvroSchema(schema)
    // @ts-ignore TODO: Fix typings for Schema...
    const avroSchema: AvroSchema = avro.Type.forSchema(rawSchema, opts)
    return avroSchema
  }

  public validate(avroSchema: AvroSchema): void {
    if (!avroSchema.name) {
      throw new ConfluentSchemaRegistryArgumentError(`Invalid name: ${avroSchema.name}`)
    }
  }

  public getSubject(
    schema: ConfluentSchema,
    // @ts-ignore
    avroSchema: AvroSchema,
    separator: string,
  ): ConfluentSubject {
    const rawSchema: RawAvroSchema = this.getRawAvroSchema(schema)

    if (!rawSchema.namespace) {
      throw new ConfluentSchemaRegistryArgumentError(`Invalid namespace: ${rawSchema.namespace}`)
    }

    const subject: ConfluentSubject = {
      name: [rawSchema.namespace, rawSchema.name].join(separator),
    }
    return subject
  }

  private isRawAvroSchema(schema: ConfluentSchema | RawAvroSchema): schema is RawAvroSchema {
    const asRawAvroSchema = schema as RawAvroSchema
    return asRawAvroSchema.name != null && asRawAvroSchema.type != null
  }

  public toConfluentSchema(data: SchemaResponse): ConfluentSchema {
    // TODO: implement for Avro references
    return { type: SchemaType.AVRO, schema: data.schema }
  }

  getReferences(_schema: AvroConfluentSchema): ReferenceType[] | undefined {
    // TODO: implement for Avro references
    return undefined
  }

  updateOptionsFromSchemaReferences(
    options: ProtocolOptions,
    _referredSchemas: (string | RawAvroSchema)[],
  ): ProtocolOptions {
    // TODO: implement for Avro references
    return options
  }
}
