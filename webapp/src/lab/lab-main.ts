import { createPinia } from "pinia"
import { createApp } from "vue"
import LabApp from "@/lab/LabApp.vue"
import "@/lab/lab-theme.css"

const pinia = createPinia()

createApp(LabApp)
  .use(pinia)
  .mount("#lab-app")
