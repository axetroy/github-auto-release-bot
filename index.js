const messageParser = require("parse-commit-message");

module.exports = robot => {
  robot.on("release.published", async context => {
    const { release } = context.payload;

    const { data: allReleases } = await context.github.repos.getReleases(
      context.repo()
    );

    const lastRelease = allReleases[1];

    if (lastRelease.tag_name === release.tag_name) {
      return;
    }

    const { data: commitDiff } = await context.github.repos.compareCommits(
      context.repo({
        base: lastRelease.tag_name,
        head: release.tag_name
      })
    );

    // get the commits between 2 tags
    const commits = commitDiff.commits || [];

    // type list
    const typeList = {
      feat: {
        label: "Features",
        list: []
      },
      fix: {
        label: "Bug Fixes",
        list: []
      },
      refactor: {
        label: "Code Refactoring",
        list: []
      },
      perf: {
        label: "Performance Improvements",
        list: []
      },
      test: {
        label: "Test",
        list: []
      },
      docs: {
        label: "Docs",
        list: []
      },
      styles: {
        label: "Style",
        list: []
      },
      chore: {
        label: "Chore",
        list: []
      },
      deps: {
        label: "Dependencies Updates",
        list: []
      },
      commit: {
        label: "Commits History",
        list: []
      }
    };

    for (const commit of commits) {
      const meta = `[${commit.sha}]`;

      try {
        const {
          type,
          scope,
          subject,
          header,
          body,
          footer
        } = messageParser.parse(commit.commit.message);

        // valid type
        if (type && typeList[type]) {
          typeList[type].list.push(
            (scope ? `**${scope}**: ` : "") + `${subject} (${commit.sha})`
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        const author = `${commit.commit.author.name} <${
          commit.commit.author.email
        }>`;
        typeList.commit.list.push(
          `${meta} - ${commit.commit.message.split("\n")[0]} (${author})`
        );
      }
    }

    const notes = [];

    for (const type in typeList) {
      const block = typeList[type];
      const raw = block.list.length
        ? `### ${block.label}
${block.list.map(v => "* " + v).join("\n")}
      `
        : "";
      notes.push(raw);
    }

    await context.github.repos.editRelease(
      context.repo({
        tag_name: release.tag_name,
        id: release.id,
        body: notes.join("\n").trim()
      })
    );
  });
};
