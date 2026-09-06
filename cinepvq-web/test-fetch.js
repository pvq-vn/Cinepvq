fetch("https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1")
  .then(async (r) => {
    console.log("Status:", r.status);
    console.log(await r.text());
  })
  .catch((err) => {
    console.error(err);
  });