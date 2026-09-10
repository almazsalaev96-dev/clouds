/* The mock, with the gap between tokens stretched. Anything that can only be
   tested *during* a stream needs a stream that lasts longer than the click.
   A file rather than an env var: this sandbox does not carry MOCK_SLOW=1
   through to a spawned process. */
process.env.MOCK_SLOW = "1";
await import("./mock-provider.mjs");
