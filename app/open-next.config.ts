import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config: OpenNextConfig = {
  default: {},
  dangerous: {
    disableIncrementalCache: true,
    disableTagCache: true,
  },
};

export default config;
