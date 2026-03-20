(() => {
  const photoBtn = document.getElementById("photoBtn");
  const scoreSection = document.getElementById("scoreSection");

  if (photoBtn && scoreSection) {
    photoBtn.addEventListener("click", () => {
      scoreSection.classList.remove("hidden");
      scoreSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
})();
