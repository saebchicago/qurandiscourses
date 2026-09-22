# Replit setup

This repository is a zero-dependency static website.

## Run

The **Start application** workflow runs:

```bash
node scripts/serve.mjs 5000
```

The custom server is required because it resolves clean URLs such as `/read`
to their corresponding `.html` files, matching the production hosting setup.