export const useStats = () => {
  const stats = [
    { name: "Rigs in-flight", value: "1,279" },
    { name: "Rigs parked", value: "1,721" },
    { name: "Num. pilots", value: "214" },
    { name: "Average FT per flight", value: "172,800" },
    { name: "Total FT earned", value: "211,011,200" },
    { name: "Badges earned", value: "151" },
    { name: "Badges visible", value: "63" },
  ];

  return { stats };
};
