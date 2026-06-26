**From the command line**

mcptest generate --dump gdk-dump.json -o tests/basic --coverage basic

mcptest generate --dump gdk-dump.json -o tests/edge --coverage edge-cases

mcptest generate --dump gdk-dump.json -o tests/full --coverage full


**With AI**

mcptest schema --copilot-prompt

=> Open VSCode and enter the prompt

--
Create mcptest YAML test scenarios for all MCP server tools.

Context:
- Dump file: attached as JSON
- MCP server return TextContent (strings), not direct JSON
- Save scenarios in: tests/mcp/

Requirements:
- Use response-type: "string" for all tool responses
- Use contains-text for content validation
- Create realistic test cases with proper arguments
- Include both success and error test cases
- Follow naming pattern: toolname-testcase.yaml

Example scenario format:
```yaml
name: "tool_name - test description"
description: "What this test validates"
tools:
  - name: "tool_name"
    arguments:
      param1: value1
      param2: value2
    assertions:
      - type: "response-type"
        expected: "string"
      - type: "contains-text"
        expected: "expected text in response"
```

Available assertion types:
- response-type: "string" | "number" | "boolean" | "object" | "array"
- contains-text: Check if response contains specific text
- error: Expect an error response
- error-code: Expect specific error code (e.g., "INVALID_PARAMS")
- array-length: Exact array length
- array-length-max: Maximum array length

Instructions:
1. Read the dump file to get all available tools and their schemas
2. For each tool, create 2-3 test scenarios:
   - Basic happy path test
   - Test with filters/options (if applicable)
   - Error case test (invalid arguments)
3. Use realistic argument values based on the tool's purpose
4. Save each scenario as tests/mcp/toolname-testcase.yaml

Create comprehensive test coverage for all tools in the dump file.
--

 mcptest validate --scenarios tests/mcp

Validation Results

✓ batch-get-documents-cloud.yaml
✓ batch-get-documents-cross-product.yaml
✓ batch-get-documents-empty-array.yaml
✓ batch-get-documents-invalid-names.yaml
✓ batch-get-documents-missing-names.yaml
✓ batch-get-documents-nonexistent.yaml
✓ batch-get-documents-single.yaml
✓ get-document-android-compose.yaml
✓ get-document-cloud-storage.yaml
✓ get-document-firebase-auth.yaml
✓ get-document-invalid-name.yaml
✓ get-document-missing-name.yaml
✓ get-document-nonexistent.yaml
✓ search-documents-android.yaml
✓ search-documents-basic.yaml
✓ search-documents-chrome.yaml
✓ search-documents-empty-query.yaml
✓ search-documents-firebase.yaml
✓ search-documents-missing-query.yaml
✓ search-documents-tensorflow.yaml

Summary
Valid:   20/20
Invalid: 0/20

All scenarios are valid!

