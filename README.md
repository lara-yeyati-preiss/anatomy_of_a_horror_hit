Live demo: [https://lara-yeyati-preiss.github.io/anatomy_of_a_horror_hit/](https://lara-yeyati-preiss.github.io/anatomy_of_a_horror_hit)

# Anatomy of a Horror Hit  
**by Lara Yeyati Preiss**  

---

## Concept  
This project explores horror as a cultural barometer—capturing, distorting, and projecting our collective fears back to us.  
Using **Netflix’s Engagement Report (Jan–Jun 2025)**, it examines what the platform’s most-watched horror titles reveal about contemporary anxieties.  

The site unfolds as a scrollytelling narrative. It begins by analyzing the **Hit Matrix**, which visualizes how a hit looks across genres by mapping quadrants defined by **IMDb ratings** (as a proxy for prestige) and **total views** (as a proxy for reach).  
It then zooms in on horror as the poster child of the *“cult corner”*: lower budgets, strong identity, and small but loyal audiences.  
Finally, it traces horror’s **recurring fear patterns**, inviting users to explore them through an **interactive bar chart** that visualizes the genre’s emotional architecture.  

---

## Data & Methods  

**Data sources:**  
- Netflix Engagement Report (Jan–Jun 2025)  
- OMDb API  
- IMDb API  

**Processing:**  
- Film metadata was fetched, cleaned, and processed in Python.  
- Each title was classified by **core fear** using a hybrid process: a local **LLaMA-3 (8B)** model run via **Ollama**, prompted with each film’s title, synopsis, and keywords, guided by a **manually designed taxonomy** and labeled examples of distinct fear categories.  
- Model results were manually reviewed and refined for thematic coherence.  
- Several fear types were consolidated into **three higher-order supergroups**, reflecting broader dimensions of human anxiety.  
- Keyword frequencies were aggregated from IMDb tags to identify the most common thematic vocabularies within each supergroup.
  



<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/c9993d96-1036-44d1-8e30-b8be3ca2baf0" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/0f45fbfc-f9e2-42f8-98c0-3a5b4d74fbd5" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/c87472a2-7085-438d-9686-4751074a0a0e" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/fa82602c-0c6b-4e71-81fc-2bd24b8e5b62" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/5097e32a-f9ab-46e6-beb7-9f37936360ae" />
<img width="1721" height="868" alt="image" src="https://github.com/user-attachments/assets/37f47c2a-c952-48d5-bfe1-0b26f8bb546a" />
