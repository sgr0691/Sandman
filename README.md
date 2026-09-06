# Sandman

```text
  ____                  _
 / ___|  __ _ _ __   __| |_ __ ___   __ _ _ __
 \___ \ / _` | '_ \ / _` | '_ ` _ \ / _` | '_ \
  ___) | (_| | | | | (_| | | | | | | (_| | | | |
 |____/ \__,_|_| |_|\__,_|_| |_| |_|\__,_|_| |_|
```

**Disposable cloud environments in seconds.**

Sandman is an open-source CLI that provisions clean, isolated environments on
AWS, GCP, Cloudflare, and Vercel — no billing setup, IAM wrangling, or API
configuration. Spin one up for a demo or experiment, tear it down when you're
done.

- **DevTool demos** — a fresh environment for every product demo
- **AI builders** — test infrastructure without touching production
- **Rapid prototyping** — go from idea to a running cloud in seconds
- **Experimentation** — learn cloud services on throwaway infrastructure

All commands accept `--json` for machine-readable output, built for humans and agents alike.

---

## Quick start

```bash
sandman init gcp                          # authenticate and configure credentials
sandman create demo                       # provision a new environment
sandman enable compute storage cloudrun   # turn on the services you need
sandman connect demo                      # print environment credentials
sandman destroy demo                      # delete everything when finished
```

For AWS, enable services with `sandman enable ec2 s3 lambda`.

---

## Commands

| Command | Description |
| --- | --- |
| `sandman init <provider>` | Authenticate and configure credentials |
| `sandman create <name>` | Provision a new environment (supports `--ttl`, `--dry-run`) |
| `sandman enable <services...>` | Enable services in the environment |
| `sandman list` | List environments |
| `sandman status <name>` | Show status, resources, and estimated cost |
| `sandman connect <name>` | Output environment credentials |
| `sandman destroy <name>` | Delete the environment and all resources |
| `sandman providers` | Show the live provider capability matrix |
| `sandman doctor` | Check init state, auth, and reap expired environments (`--reap`) |

---

## Installation

```bash
npm install -g @itssergio91/sandman
```

Or run without installing:

```bash
npx @itssergio91/sandman
```

---

## Providers

| Provider | Status |
| --- | --- |
| AWS | ✅ Supported |
| GCP | ✅ Supported |
| Cloudflare | 🧪 Experimental |
| Vercel | 🧪 Experimental |
| DigitalOcean | 🚧 Planned |
| Render | 🚧 Planned |

Run `sandman providers` to see the live capability matrix.

---

## Roadmap

- Environment templates
- Multi-cloud provisioning (Cloudflare / Vercel beyond experimental)
- GitHub demo environments
- Local testing environments

See the [issue tracker](https://github.com/BoringInfraCo/Sandman/issues) for the full list.

---

## Contributing

Pull requests are welcome. Clone the repo, run `npm install` and `npm test`, and open a PR.

## License

MIT
