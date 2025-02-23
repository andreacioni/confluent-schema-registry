---
id: usage
title: Usage
sidebar_label: Usage
---

Typical usage consists of [uploading one or more schemas](#uploading-schemas) to the registry, [encoding
data](#encoding-data) using the registered schemas, and/or [decoding encoded data](#decoding-data) by getting
the schemas from the registry.

## Creating the registry client

```js
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')

const registry = new SchemaRegistry({ host: 'http://localhost:8081' })
```

For more configuration options, [see configuration](#configuration).

## Uploading schemas

The schemas can be registered with the schema registry using
`registry.register({ type: SchemaType, schema: string })`, which resolves to an object containing the
schema id. This schema id is later [used when encoding](#encoding-data).

```js
const schema = {
  type: SchemaType.AVRO | SchemaType.JSON | SchemaType.PROTOBUF,
  schema: "string"
}

const options = {
  subject: "string"
}

await registry.register(schema, options)
```

### Avro

```js
const schema = `
  {
    "type": "record",
    "name": "RandomTest",
    "namespace": "examples",
    "fields": [{ "type": "string", "name": "fullName" }]
  }
`
const { id } = await registry.register({ type: SchemaType.AVRO, schema })
```

To simplify working with Avro schemas and integrating with existing tooling,
some utility functions are available. Schemas can be defined in either `AVSC`
or `AVDL` format, and are read using `readAVSCAsync` and `avdlToAVSCAsync`
respectively.

Note that these functions return objects rather than strings, but they can
be passed directly to `register` as the `schema` argument and will be
stringified internally.

```js
const { SchemaType, readAVSCAsync, avdlToAVSCAsync } = require('@kafkajs/confluent-schema-registry')

// From an avsc file
const schema = await readAVSCAsync('path/to/schema.avsc')
const { id } = await registry.register({ type: SchemaType.AVRO, schema }) // { id: 2 }

// From an avdl file
const schema = await avdlToAVSCAsync('path/to/protocol.avdl')
const { id } = await registry.register({ type: SchemaType.AVRO, schema }) // { id: 3 }
```

#### Subject

For Avro schemas, the subject is automatically inferred from the schema if
`options.subject` is not set.

> See [Subjects](#subjects) for more information on subjects

### JSON Schema

```js
const { SchemaType } = require('@kafkajs/confluent-schema-registry')

const schema = `
  {
    "definitions" : {
      "record:examples.Person" : {
        "type" : "object",
        "required" : [ "fullName" ],
        "additionalProperties" : false,
        "properties" : {
          "fullName" : {
            "type" : "string"
          }
        }
      }
    },
    "$ref" : "#/definitions/record:examples.Person"
  }
`
const { id } = await registry.register({ type: SchemaType.JSON, schema })
```

### Protobuf

```js
const { SchemaType } = require('@kafkajs/confluent-schema-registry')

const schema = `
  package examples;
  message RandomTest {
    required string fullName = 1;
  }
`
const { id } = await registry.register({ type: SchemaType.PROTOBUF, schema })
```

### Compatibility

The [compatibility](https://docs.confluent.io/current/schema-registry/avro.html#compatibility-types) of the schema will be whatever the global default is (typically `BACKWARD`).
It's possible to override this for the specific subject by setting it like so:

```js
const {
  COMPATIBILITY: { NONE },
} = require('@kafkajs/confluent-schema-registry')
await registry.register(schema, { compatibility: NONE })
```

**NOTE:**
If the subject already has an overridden compatibility setting and it's different,
the client will throw and error (`ConfluentSchemaRegistryCompatibilityError`)

### Subjects

Each schema is registered under a [subject](https://docs.confluent.io/current/schema-registry/serializer-formatter.html#sr-avro-subject-name-strategy).
In Avro, this subject is generated by concatenating the schema namespace and the schema name
with a separator. For example, the following schema would get the subject `com.example.Simple`:

```avdl
@namespace("com.example")
protocol SimpleProto {
  record Simple {
    string foo;
  }
}
```

`registry.register` accepts a `subject` option to override the subject entirely:

```js
await registry.register(schema, { subject: 'my-fixed-subject' })
```

If you just want to change the separator used when automatically creating the subject, use
the `separator` option:

```js
// This would result in "com.example-Simple"
await registry.register(schema, { separator: '-' })
```

#### Other schema types

For non-Avro schema types, `subject` is required and the method will throw if not provided.

## Encoding data

To encode data, call `registry.encode` with the schema id and the payload to encode.

```js
const payload = { full_name: 'John Doe' }
await registry.encode(id, payload)
```

## Decoding data

The encoded payload contains the schema id of the schema used to decode it,
so to decode, simply call `registry.decode` with the encoded payload. The
corresponding schema will be downloaded from the registry if needed in order
to decode the payload.

```js
const payload = await registry.decode(buffer)
// { full_name: 'John Doe' }
```

`registry.decode` has an optional second `options` argument with options
specific to each schema type.

### Avro

With Avro you can specify a specific reader schema to use to decode the
message, rather than using the schema registered in the registry. This can
be useful if you need a projection that is different from the writer schema,
or if you want to decode a message with a different version than was
used to encode the message.

```js
import avro from 'avsc'
import { readAVSCAsync } from '@kafkajs/confluent-schema-registry'

const readerSchema = await readAVSCAsync('path/to/protocol.avdl')

const payload = await registry.decode(buffer, {
  [SchemaType.AVRO]: { readerSchema }
})
```

## Configuration

### Retry

By default, all `GET` requests will retry three times in case of failure. If you want to tweak this config you can do:

```js
const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
  retry: {
    maxRetryTimeInSecs: 5,
    initialRetryTimeInSecs: 0.1,
    factor: 0.2, // randomization factor
    multiplier: 2, // exponential factor
    retries: 3, // max retries
  },
})
```

### Basic auth

It's also possible to configure basic auth:

```js
const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
  auth: {
    username: '***',
    password: '***',
  },
})
```

### HTTP Agent

Configuring the behavior of the HTTP requests towards the schema registry API
can be done by passing in an instance of an [Agent](https://nodejs.org/api/https.html#https_class_https_agent).

```ts
import { Agent } from 'http'

const agent = new Agent({ keepAlive: true })
const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
  agent
})
```

HTTP Agent configuration offer a high degree of customization for underlying both HTTP and HTTPS requests. 

#### TLS/SSL Authentication

If your Schema Registry requires TLS/SSL Authentication you can pass a custom `https.Agent` to its constructor which accept the options available in [tls.createSecureSocket()](https://nodejs.org/docs/latest/api/tls.html#tlscreatesecurecontextoptions).

```js
import { Agent } from 'https'
import * as fs from 'fs'

const agent = new Agent({ 
    ca: [ fs.readFileSync('/path/to/yourca.crt', 'utf-8') ],
    cert: fs.readFileSync('/path/to/yourcert.crt', 'utf-8'),
    key: fs.readFileSync('/path/to/yourket.key', 'utf-8')
})

const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
  agent
})
```

Alteratively if you have PKCS12/PFX encoded certificate and key you can pass it as shown below:

```js
import { Agent } from 'https'
import * as fs from 'fs'

const agent = new Agent({ 
    pfx: {
      buf: fs.readFileSync('/path/to/keystore.p12'),
      passphrase: 'your-keystore-password'
    }
})

const registry = new SchemaRegistry({
  host: 'http://localhost:8081',
  agent
})
```


### Schema type options

The second argument to the `SchemaRegistry` constructor is an object with keys for each `SchemaType`.

#### Avro

The Avro schema type options are passed directly to
[`avsc.Type.forSchema` as the `opts` argument](https://github.com/mtth/avsc/wiki/API#typeforschemaschema-opts).
For example:

```ts
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry'

const options = {
  [SchemaType.AVRO]: {
    logicalTypes: { decimal: DecimalType }
  }
}

const registry = new SchemaRegistry({ host: 'http://localhost:8081' }, options)
```

#### Protobuf

The only available option is `messageName`, which is used to select which message
in a schema containing multiple messages to use for encoding/decoding the payload.
If omitted, the first message type in the schema is used.

```ts
const options = {
  [SchemaType.PROTOBUF]: {
    messageName: 'CustomMessage'
  }
}
```


#### JSON Schema

The JSON Schema schema type options are passed to the [Ajv constructor](https://ajv.js.org/options.html).
For example:

```ts
const options = {
  [SchemaType.JSON]: {
    strict: true
  }
}
```

Alternatively, you can provide a custom Ajv instance using the `ajvInstance` option. This can be useful if you
need to configure Ajv outside of what the constructor parameters allow.

```ts
const options = {
  [SchemaType.JSON]: {
    ajvInstance: new Ajv()
  }
}
```