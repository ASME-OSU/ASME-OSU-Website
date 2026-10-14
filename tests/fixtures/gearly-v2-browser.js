/* Local browser QA only: fabricated public rows, never loaded by production embeds. */
(function () {
  if (new URLSearchParams(location.search).get('qa') !== 'member') return;
  var notice = document.createElement('aside');
  notice.textContent = 'Gearly QA fixture — fabricated member records for reviewing candidate choices.';
  notice.style.cssText = 'padding:12px;background:#fff1bd;color:#29220d;border:1px solid #aa9038';
  document.body.prepend(notice);
  var nativeFetch = window.fetch.bind(window);
  var rows = [
    [1, 'Avery Example', 'Autumn 2026', 12, 3, 'Active', '2026-10-14', 1, 1, 1, 0, 0, 0, 0, 'Company info sessions'],
    [2, 'Avery Example', 'Spring 2026', 9, 2, 'Active', '2026-05-01', 1, 0, 1, 0, 0, 0, 0, 'General body meetings']
  ];
  window.fetch = function (value, options) {
    var url = new URL(String(value), location.href);
    if (url.hostname !== 'docs.google.com') return nativeFetch(value, options);
    var values = url.searchParams.get('sheet') === 'System_Status' ? [['system_status', 'LIVE']] : rows;
    var body = JSON.stringify({ status: 'ok', table: { rows: values.map(function (row) { return { c: row.map(function (v) { return { v: v }; }) }; }) } });
    return Promise.resolve(new Response('google.visualization.Query.setResponse(' + body + ');', { status: 200 }));
  };
})();
