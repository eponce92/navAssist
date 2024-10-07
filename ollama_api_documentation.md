# OpenAI compatibility

> **Note:** OpenAI compatibility is experimental and is subject to major adjustments including breaking changes. For fully-featured access to the Ollama API, see the Ollama [Python library](https://github.com/ollama/ollama-python), [JavaScript library](https://github.com/ollama/ollama-js) and [REST API](https://github.com/ollama/ollama/blob/main/docs/api.md).

Ollama provides experimental compatibility with parts of the [OpenAI API](https://platform.openai.com/docs/api-reference) to help connect existing applications to Ollama.

## Usage

### OpenAI Python library

```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:11434/v1/',

    # required but ignored
    api_key='ollama',
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            'role': 'user',
            'content': 'Say this is a test',
        }
    ],
    model='llama3.2',
)

response = client.chat.completions.create(
    model="llava",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {
                    "type": "image_url",
                    "image_url": "iVBORw0KGgoAAAANSUhEUgAAAG0AAABmCAYAAADBPx+VAAAACXBIWXMA",
                },
            ],
        }
    ],
    max_tokens=300,
)

completion = client.completions.create(
    model="llama3.2",
    prompt="Say this is a test",
)

list_completion = client.models.list()

model = client.models.retrieve("llama3.2")

embeddings = client.embeddings.create(
    model="all-minilm",
    input=["why is the sky blue?", "why is the grass green?"],
)
```

### OpenAI JavaScript library

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:11434/v1/",

  // required but ignored
  apiKey: "ollama",
});

const chatCompletion = await openai.chat.completions.create({
  messages: [{ role: "user", content: "Say this is a test" }],
  model: "llama3.2",
});

const response = await openai.chat.completions.create({
  model: "llava",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url:
            "iVBORw0KGgoAAAANSUhEUgAAAG0AAABmCAYAAADBPx+VAAAACXBIWXMAAAsTAA",
        },
      ],
    },
  ],
});

const completion = await openai.completions.create({
  model: "llama3.2",
  prompt: "Say this is a test.",
});

const listCompletion = await openai.models.list();

const model = await openai.models.retrieve("llama3.2");

const embedding = await openai.embeddings.create({
  model: "all-minilm",
  input: ["why is the sky blue?", "why is the grass green?"],
});
```

### `curl`

```shell
curl http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama3.2",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": "Hello!"
            }
        ]
    }'

curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llava",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What'\''s in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
               "url": "iVBORw0KGgoAAAANSUhEUgAAAG0AAABmCAYAAADBPx+VAAAACXBIWXMAAAsTAAALEwEAmp
            }
          }
        ]
      }
    ],
    "max_tokens": 300
  }'

curl http://localhost:11434/v1/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama3.2",
        "prompt": "Say this is a test"
    }'

curl http://localhost:11434/v1/models

curl http://localhost:11434/v1/models/llama3.2

curl http://localhost:11434/v1/embeddings \
    -H "Content-Type: application/json" \
    -d '{
        "model": "all-minilm",
        "input": ["why is the sky blue?", "why is the grass green?"]
    }'
```

## Endpoints

### `/v1/chat/completions`

#### Supported features

- [x] Chat completions
- [x] Streaming
- [x] JSON mode
- [x] Reproducible outputs
- [x] Vision
- [x] Tools (streaming support coming soon)
- [ ] Logprobs

#### Supported request fields

- [x] `model`
- [x] `messages`
  - [x] Text `content`
  - [x] Image `content`
    - [x] Base64 encoded image
    - [ ] Image URL
  - [x] Array of `content` parts
- [x] `frequency_penalty`
- [x] `presence_penalty`
- [x] `response_format`
- [x] `seed`
- [x] `stop`
- [x] `stream`
- [x] `temperature`
- [x] `top_p`
- [x] `max_tokens`
- [x] `tools`
- [ ] `tool_choice`
- [ ] `logit_bias`
- [ ] `user`
- [ ] `n`

### `/v1/completions`

#### Supported features

- [x] Completions
- [x] Streaming
- [x] JSON mode
- [x] Reproducible outputs
- [ ] Logprobs

#### Supported request fields

- [x] `model`
- [x] `prompt`
- [x] `frequency_penalty`
- [x] `presence_penalty`
- [x] `seed`
- [x] `stop`
- [x] `stream`
- [x] `temperature`
- [x] `top_p`
- [x] `max_tokens`
- [x] `suffix`
- [ ] `best_of`
- [ ] `echo`
- [ ] `logit_bias`
- [ ] `user`
- [ ] `n`

#### Notes

- `prompt` currently only accepts a string

### `/v1/models`

#### Notes

- `created` corresponds to when the model was last modified
- `owned_by` corresponds to the ollama username, defaulting to `"library"`

### `/v1/models/{model}`

#### Notes

- `created` corresponds to when the model was last modified
- `owned_by` corresponds to the ollama username, defaulting to `"library"`

### `/v1/embeddings`

#### Supported request fields

- [x] `model`
- [x] `input`
  - [x] string
  - [x] array of strings
  - [ ] array of tokens
  - [ ] array of token arrays
- [ ] `encoding format`
- [ ] `dimensions`
- [ ] `user`

## Models

Before using a model, pull it locally `ollama pull`:

```shell
ollama pull llama3.2
```

### Default model names

For tooling that relies on default OpenAI model names such as `gpt-3.5-turbo`, use `ollama cp` to copy an existing model name to a temporary name:

```
ollama cp llama3.2 gpt-3.5-turbo
```

Afterwards, this new model name can be specified the `model` field:

```shell
curl http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "user",
                "content": "Hello!"
            }
        ]
    }'
```

### Setting the context size

The OpenAI API does not have a way of setting the context size for a model. If you need to change the context size, create a `Modelfile` which looks like:

```modelfile
FROM <some model>
PARAMETER num_ctx <context size>
```

Use the `ollama create mymodel` command to create a new model with the updated context size. Call the API with the updated model name:

```shell
curl http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "mymodel",
        "messages": [
            {
                "role": "user",
                "content": "Hello!"
            }
        ]
    }'
```

OpenAI compatibility
February 8, 2024
OpenAI compatibility

Ollama now has built-in compatibility with the OpenAI Chat Completions API, making it possible to use more tooling and applications with Ollama locally.

Setup
Start by downloading Ollama and pulling a model such as Llama 2 or Mistral:

ollama pull llama2
Usage
cURL
To invoke Ollama’s OpenAI compatible API endpoint, use the same OpenAI format and change the hostname to http://localhost:11434:

curl http://localhost:11434/v1/chat/completions \
 -H "Content-Type: application/json" \
 -d '{
"model": "llama2",
"messages": [
{
"role": "system",
"content": "You are a helpful assistant."
},
{
"role": "user",
"content": "Hello!"
}
]
}'
OpenAI Python library
from openai import OpenAI

client = OpenAI(
base_url = 'http://localhost:11434/v1',
api_key='ollama', # required, but unused
)

response = client.chat.completions.create(
model="llama2",
messages=[
{"role": "system", "content": "You are a helpful assistant."},
{"role": "user", "content": "Who won the world series in 2020?"},
{"role": "assistant", "content": "The LA Dodgers won in 2020."},
{"role": "user", "content": "Where was it played?"}
]
)
print(response.choices[0].message.content)
OpenAI JavaScript library
import OpenAI from 'openai'

const openai = new OpenAI({
baseURL: 'http://localhost:11434/v1',
apiKey: 'ollama', // required but unused
})

const completion = await openai.chat.completions.create({
model: 'llama2',
messages: [{ role: 'user', content: 'Why is the sky blue?' }],
})

console.log(completion.choices[0].message.content)
Examples
Vercel AI SDK
The Vercel AI SDK is an open-source library for building conversational streaming applications. To get started, use create-next-app to clone the example repo:

npx create-next-app --example https://github.com/vercel/ai/tree/main/examples/next-openai example
cd example
Then make the following two edits in app/api/chat/route.ts to update the chat example to use Ollama:

const openai = new OpenAI({
baseURL: 'http://localhost:11434/v1',
apiKey: 'ollama',
});
const response = await openai.chat.completions.create({
model: 'llama2',
stream: true,
messages,
});
Next, run the app:

npm run dev
Finally, open the example app in your browser at http://localhost:3000:

Autogen
Autogen is a popular open-source framework by Microsoft for building multi-agent applications. For this, example we’ll use the Code Llama model:

ollama pull codellama
Install Autogen:

pip install pyautogen
Then create a Python script example.py to use Ollama with Autogen:

from autogen import AssistantAgent, UserProxyAgent

config_list = [
{
"model": "codellama",
"base_url": "http://localhost:11434/v1",
"api_key": "ollama",
}
]

assistant = AssistantAgent("assistant", llm_config={"config_list": config_list})

user_proxy = UserProxyAgent("user_proxy", code_execution_config={"work_dir": "coding", "use_docker": False})
user_proxy.initiate_chat(assistant, message="Plot a chart of NVDA and TESLA stock price change YTD.")
Lastly, run the example to have the assistant write the code to plot a chart:

python example.py
More to come
This is initial experimental support for the OpenAI API. Future improvements under consideration include:

Embeddings API
Function calling
Vision support
Logprobs
GitHub issues are welcome! For more information, see the OpenAI compatibility docs.
