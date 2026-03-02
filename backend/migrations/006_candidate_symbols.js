function hasColumn(columns, name) {
  return columns.some((col) => col.name === name);
}

module.exports = {
  id: "006_candidate_symbols",
  name: "Add and seed candidate election symbols",
  async up({ run, all }) {
    const cols = await all("PRAGMA table_info(candidates)");
    if (!hasColumn(cols, "symbol")) {
      await run("ALTER TABLE candidates ADD COLUMN symbol TEXT");
    }

    const mappings = [
      ["Narendra Modi", "Lotus"],
      ["Rahul Gandhi", "Open Hand"],
      ["Mamata Banerjee", "Grass & Flowers"],
      ["A. P. J. Abdul Kalam", "Missile"],
      ["Atal Bihari Vajpayee", "Lamp"],
      ["Sardar Vallabhbhai Patel", "Plough"],
      ["Barack Obama", "Rising Sun"],
      ["Joe Biden", "Torch"],
      ["Abraham Lincoln", "Top Hat"]
    ];

    for (const [name, symbol] of mappings) {
      await run("UPDATE candidates SET symbol=COALESCE(NULLIF(symbol,''), ?) WHERE LOWER(name)=LOWER(?)", [symbol, name]);
    }

    await run(
      "UPDATE candidates SET symbol=COALESCE(NULLIF(symbol,''), 'Civic Emblem') WHERE symbol IS NULL OR TRIM(symbol)=''"
    );
  }
};
