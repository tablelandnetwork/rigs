const missions = Object.fromEntries(
  [
    {
      id: "id-1",
      name: "Amplify Tableland with a Quote Retweet Earning 10+ Likes",
      description:
        "Spread the word about Tableland by quote retweeting one of our tweets and gaining 10+ likes.",
      requirements: [
        "The quote retweet must be relevant and add value to the original Tableland tweet. It could provide additional insights, personal experiences, or constructive comments.",
        "The likes must come from genuine, non-bot Twitter accounts. Any indication of artificial likes will disqualify the entry.",
      ],
      tags: ["Media"],
      deliverables: [
        {
          name: "Link",
          description:
            "A link to the quote retweet that meets the required criteria.",
        },
        {
          name: "Screenshot",
          description:
            "A screenshot showing the quote retweet with 10+ likes. Please ensure the number of likes and the content of the quote retweet are clearly visible in the screenshot.",
        },
      ],
      reward: { amount: 300_000, currency: "FT" },
    },
    {
      id: "id-2",
      name: "100+ Likes for Original Tweet Promoting Tableland or Rigs",
      description:
        "Original tweet that highlights unique aspects of Tableland and/or Rigs. Goal is to create a tweet that resonates with the community and garners 100+ likes.",
      requirements: [
        "The tweet must contain original content about Tableland and/or Rigs. It could be about your personal experience, the project's unique features, or its impact on the community.",
        "The likes must come from genuine, non-bot Twitter accounts. Any indication of artificial likes will disqualify the entry.",
      ],
      tags: ["Media"],
      deliverables: [
        {
          name: "Link",
          description: "A link to the tweet that meets the required criteria.",
        },
        {
          name: "Screenshot",
          description:
            "A screenshot showing the tweet with 100+ likes. Please ensure the number of likes and the content of the tweet are clearly visible in the screenshot.",
        },
      ],
      reward: { amount: 3_500_000, currency: "FT" },
    },
    {
      id: "id-3",
      name: "Tableland Integration Guides for New Protocols",
      description:
        "Comprehensive technical guides that detail the process of integrating Tableland with a protocol not yet covered in our existing documentation.",
      requirements: [
        "The guide should provide detailed, step-by-step instructions on how to integrate Tableland with another technology stack. This includes initial setup, making and handling requests, security considerations, and error handling.",
        "All submissions must contain clear explanations, working code snippets, and best practice advice.",
        "The guide must cover an integration not already outlined in our existing documentation.",
      ],
      tags: ["Showcase"],
      deliverables: [
        {
          name: "Link",
          description:
            "A comprehensive technical integration document. This should include a clear, step-by-step guide for integrating Tableland into another technology stack.",
        },
        {
          name: "Link",
          description:
            "Working code samples. These should illustrate how to perform tasks and should be accompanied by explanations to ensure they are understandable and replicable.",
        },
      ],
      reward: { amount: 2_000_000, currency: "FT" },
    },
  ].map((v) => [v.id, v])
);

export const useOpenMissions = () => ({ missions: Object.values(missions) });

export const useMission = (id?: string) => {
  if (id) return { mission: missions[id] };

  return { mission: undefined };
};
