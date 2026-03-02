module.exports = {
  id: "005_candidate_profiles_seed",
  name: "Seed detailed candidate profiles and additional India/US leaders",
  async up({ run, get, all }) {
    const profiles = [
      {
        name: "Narendra Modi",
        party: "BJP",
        image: "bjp.jpg",
        bio: "Serving as Prime Minister of India since 2014, with focus areas including digital public infrastructure, manufacturing growth, and international diplomacy.",
        manifestoUrl: "https://www.bjp.org/"
      },
      {
        name: "Rahul Gandhi",
        party: "Congress",
        image: "cong.png",
        bio: "Senior Congress leader and Member of Parliament, known for positions on social justice, institutional accountability, and welfare-oriented governance.",
        manifestoUrl: "https://inc.in/"
      },
      {
        name: "Mamata Banerjee",
        party: "TMC",
        image: "tmclogo.png",
        bio: "Chief Minister of West Bengal, recognized for regional governance priorities and grassroots political mobilization.",
        manifestoUrl: "https://aitcofficial.org/"
      },
      {
        name: "A. P. J. Abdul Kalam",
        party: "Independent (Demo)",
        image: null,
        bio: "Former President of India, aerospace scientist, and an enduring symbol of scientific progress, youth development, and public service.",
        manifestoUrl: "https://en.wikipedia.org/wiki/A._P._J._Abdul_Kalam"
      },
      {
        name: "Atal Bihari Vajpayee",
        party: "BJP (Legacy)",
        image: null,
        bio: "Former Prime Minister of India known for coalition-era governance, infrastructure planning, and diplomatic outreach.",
        manifestoUrl: "https://en.wikipedia.org/wiki/Atal_Bihari_Vajpayee"
      },
      {
        name: "Sardar Vallabhbhai Patel",
        party: "National Unity (Legacy)",
        image: null,
        bio: "Key architect of post-independence national integration, widely remembered for institution-building and federal consolidation.",
        manifestoUrl: "https://en.wikipedia.org/wiki/Vallabhbhai_Patel"
      },
      {
        name: "Barack Obama",
        party: "Democratic (US)",
        image: null,
        bio: "44th President of the United States, associated with healthcare reform, economic recovery policies, and multilateral diplomacy.",
        manifestoUrl: "https://en.wikipedia.org/wiki/Barack_Obama"
      },
      {
        name: "Joe Biden",
        party: "Democratic (US)",
        image: null,
        bio: "46th President of the United States with policy focus on infrastructure, climate commitments, and alliance-driven foreign policy.",
        manifestoUrl: "https://en.wikipedia.org/wiki/Joe_Biden"
      },
      {
        name: "Abraham Lincoln",
        party: "Republican (US Legacy)",
        image: null,
        bio: "16th President of the United States, historically recognized for preserving the Union and leading constitutional transformation.",
        manifestoUrl: "https://en.wikipedia.org/wiki/Abraham_Lincoln"
      }
    ];

    const candidateIds = [];
    for (const profile of profiles) {
      const existing = await get("SELECT id,image FROM candidates WHERE LOWER(name)=LOWER(?) LIMIT 1", [profile.name]);
      if (!existing) {
        const inserted = await run(
          "INSERT INTO candidates (name,party,image,bio,manifesto_url) VALUES (?,?,?,?,?)",
          [profile.name, profile.party, profile.image, profile.bio, profile.manifestoUrl]
        );
        candidateIds.push(inserted.lastID);
      } else {
        await run(
          `UPDATE candidates
           SET party=?, image=COALESCE(image, ?), bio=?, manifesto_url=COALESCE(manifesto_url, ?)
           WHERE id=?`,
          [profile.party, profile.image, profile.bio, profile.manifestoUrl, existing.id]
        );
        candidateIds.push(existing.id);
      }
    }

    await run(
      "UPDATE candidates SET bio=COALESCE(NULLIF(TRIM(bio),''), 'Experienced public leader with policy and governance background.')"
    );

    const activeElections = await all("SELECT id FROM elections WHERE status='active' AND is_archived=0");
    let electionIds = activeElections.map((row) => row.id);
    if (!electionIds.length) {
      const latestElection = await get("SELECT id FROM elections ORDER BY datetime(created_at) DESC, id DESC LIMIT 1");
      electionIds = latestElection ? [latestElection.id] : [];
    }

    for (const electionId of electionIds) {
      for (const candidateId of candidateIds) {
        await run("INSERT OR IGNORE INTO election_candidates (election_id,candidate_id) VALUES (?,?)", [
          electionId,
          candidateId
        ]);
      }
    }
  }
};
