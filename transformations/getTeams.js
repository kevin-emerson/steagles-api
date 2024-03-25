// export const transformTeamData = (data) => {
//     const teamsArray = [];
//     let teamCount = data.fantasy_content.users[0].user[1].games[0].game[1].teams.count;
//     let teams = data.fantasy_content.users[0].user[1].games[0].game[1].teams;
//
//     for(let i = 0; i < teamCount; i++){
//         const leagueId = teams[i].team[0][0].team_key.split('.')[2];
//         const teamData = {
//             leagueId: leagueId,
//             name: teams[i].team[0][2].name,
//             imageUrl: teams[i].team[0][5].team_logos[0].team_logo.url,
//         }
//         teamsArray.push(teamData);
//     }
//
//     return teamsArray;
// }
