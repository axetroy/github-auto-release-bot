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
        icon: ":rocket:"
      },
      fix: {
        label: "Bug Fixes",
        icon: ":bug:"
      },
      refactor: {
        label: "Code Refactoring",
        icon: ":pushpin:"
      },
      perf: {
        label: "Performance Improvements",
        icon: ":zap:"
      },
      test: {
        label: "Test",
        icon: ":paperclip:"
      },
      docs: {
        label: "Docs",
        icon: ":memo:"
      },
      styles: {
        label: "Style",
        icon: ":gem:"
      },
      chore: {
        label: "Chore",
        icon: ":gear:"
      },
      deps: {
        label: "Dependencies Updates",
        icon: ":tm:"
      },
      commit: {
        label: "Commits History",
        icon: ":scroll:"
      }
    };

    const contributors = {};

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
          typeList[type].list = typeList[type].list || [];
          typeList[type].list.push(
            (scope ? `**${scope}**: ` : "") + `${subject} (${commit.sha})`
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        const author = commit.commit.author.name;
        contributors[author] = 1;
        typeList.commit.list = typeList.commit.list || [];
        typeList.commit.list.push(
          `${meta} - ${commit.commit.message.split("\n")[0]} (${author})`
        );
      }
    }

    const notes = [
      `Thanks ${Object.keys(contributors).length} contributors fot this release.`
    ];

    for (const type in typeList) {
      const block = typeList[type];
      block.list = block.list || [];
      const raw = block.list.length
        ? `### ${block.icon ? block.icon + " " + block.label : block.label}
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
