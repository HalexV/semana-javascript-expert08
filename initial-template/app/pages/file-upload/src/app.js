import Clock from "./deps/clock.js";
import View from "./view.js";

const view = new View();
const clock = new Clock();

let took = "";

view.configureOnFileChange((file) => {
  clock.start((time) => {
    took = time;
    view.updateElapsedTime(`Process started ${time}`);
  });

  setTimeout(() => {
    clock.stop();
    view.updateElapsedTime(`Process took ${took.replace("ago", "")}`);
  }, 5000);
});

// Serve para não ter que ficar clicando no botão de upload e escolher o arquivo nessa etapa de desenvolvimento. Caso contrário toda vez teria que clicar lá e ficar escolhendo o arquivo.
async function fakeFetch() {
  const filePath = "/videos/frag_bunny.mp4";
  const response = await fetch(filePath);

  // traz o tamanho do arquivo
  //   const response = await fetch(filePath, {
  //     method: "HEAD",
  //   });
  // response.headers.get('content-length')
  // debugger

  const file = new File([await response.blob()], filePath, {
    type: "video/mp4",
    lastModified: Date.now(),
  });

  const event = new Event("change");
  Reflect.defineProperty(event, "target", {
    value: {
      files: [file],
    },
  });

  document.getElementById("fileUpload").dispatchEvent(event);
}

fakeFetch();
