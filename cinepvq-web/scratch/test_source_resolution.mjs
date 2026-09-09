import { resolveAllAvailableSourcesServer } from "../services/videoSources/index.js";

async function test() {
  console.log("Testing source resolution...");
  // Test with movie slug 'tro-choi-con-muc' or similar
  const res3 = await resolveAllAvailableSourcesServer({
    slug: "tro-choi-con-muc",
    season: 1,
    episode: 3,
    type: "series",
    episodeSlug: "tap-03",
    nguoncEmbedUrl: "https://player.phimapi.com/player/?url=test"
  });
  console.log("Sources for Ep 3:", res3.map(s => ({ id: s.sourceId, name: s.name, type: s.type })));

  const res6 = await resolveAllAvailableSourcesServer({
    slug: "tro-choi-con-muc",
    season: 1,
    episode: 6,
    type: "series",
    episodeSlug: "tap-06",
    nguoncEmbedUrl: "https://player.phimapi.com/player/?url=test"
  });
  console.log("Sources for Ep 6:", res6.map(s => ({ id: s.sourceId, name: s.name, type: s.type })));
}

test().catch(console.error);
